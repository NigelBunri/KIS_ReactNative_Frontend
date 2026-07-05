import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AssignmentsScreen'>;

type Assignment = {
  id: string;
  title: string;
  due_date: string;
  max_score: number;
  status: 'not_submitted' | 'submitted' | 'graded';
  score?: number;
  feedback?: string;
  submission_id?: string;
};

export default function AssignmentsScreen({ route, navigation }: Props) {
  const { classroomId } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [textResponse, setTextResponse] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.education.assignments + `?classroom=${classroomId}`)
        .then((res: any) => {
          if (active) setAssignments(res?.data ?? res ?? []);
        })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [classroomId]),
  );

  const handleSubmit = async (assignmentId: string) => {
    if (!textResponse.trim() && !fileUrl.trim()) {
      Alert.alert('Validation', 'Please provide a response or file URL.');
      return;
    }
    setSubmitting(true);
    try {
      await postRequest(ROUTES.education.submissions, {
        assignment: assignmentId,
        text_response: textResponse,
        file_urls: fileUrl ? [fileUrl] : [],
      });
      Alert.alert('Success', 'Assignment submitted.');
      setExpandedId(null);
      setTextResponse('');
      setFileUrl('');
      const res: any = await getRequest(ROUTES.education.assignments + `?classroom=${classroomId}`);
      setAssignments(res?.data ?? res ?? []);
    } catch {
      Alert.alert('Error', 'Failed to submit assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (s: string) => {
    if (s === 'graded') return palette.primary;
    if (s === 'submitted') return palette.gold;
    return palette.subtext;
  };

  const statusLabel = (s: string) => {
    if (s === 'graded') return 'Graded';
    if (s === 'submitted') return 'Submitted';
    return 'Not Submitted';
  };

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
      minHeight: 56,
    },
    backBtn: { marginRight: 12, minWidth: 44, minHeight: 44, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: palette.text },
    scroll: { flex: 1 },
    content: { padding: sp, paddingBottom: 80 },
    card: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: sp,
      marginBottom: 12,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    title: { fontSize: 15, fontWeight: '600', color: palette.text, flex: 1, marginRight: 8 },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    badgeText: { fontSize: 11, fontWeight: '700', color: palette.ivory },
    meta: { fontSize: 13, color: palette.subtext, marginTop: 4 },
    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    scoreText: { fontSize: 14, fontWeight: '600', color: palette.primary },
    feedbackText: { fontSize: 13, color: palette.subtext, marginTop: 4, fontStyle: 'italic' },
    divider: { height: 1, backgroundColor: palette.divider, marginVertical: 10 },
    label: { fontSize: 13, color: palette.subtext, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 8,
      padding: 10,
      fontSize: 14,
      color: palette.text,
      backgroundColor: palette.surface,
      marginBottom: 10,
      minHeight: 44,
    },
    textArea: { minHeight: 100, textAlignVertical: 'top' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { textAlign: 'center', color: palette.subtext, marginTop: 40 },
    tapHint: { fontSize: 12, color: palette.subtext, marginTop: 6 },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="chevron-back-outline" size={22} color={palette.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Assignments</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {assignments.length === 0 && (
          <Text style={styles.empty}>No assignments found.</Text>
        )}
        {assignments.map((item) => {
          const isOpen = expandedId === item.id;
          const canSubmit = item.status === 'not_submitted';
          return (
            <View key={item.id} style={styles.card}>
              <Pressable
                onPress={() => canSubmit ? setExpandedId(isOpen ? null : item.id) : null}
                hitSlop={4}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <View style={styles.row}>
                  <Text style={styles.title}>{item.title}</Text>
                  <View style={[styles.badge, { backgroundColor: statusColor(item.status) }]}>
                    <Text style={styles.badgeText}>{statusLabel(item.status)}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>
                  Due: {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'N/A'}
                  {'  '}Max Score: {item.max_score}
                </Text>
                {canSubmit && (
                  <Text style={styles.tapHint}>{isOpen ? 'Tap to collapse' : 'Tap to submit'}</Text>
                )}
              </Pressable>

              {item.status === 'graded' && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.scoreRow}>
                    <KISIcon name="ribbon-outline" size={16} color={palette.primary} />
                    <Text style={styles.scoreText}>
                      Score: {item.score} / {item.max_score}
                    </Text>
                  </View>
                  {item.feedback ? (
                    <Text style={styles.feedbackText}>Feedback: {item.feedback}</Text>
                  ) : null}
                </>
              )}

              {isOpen && canSubmit && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.label}>Your Response</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Write your response..."
                    placeholderTextColor={palette.subtext}
                    value={textResponse}
                    onChangeText={setTextResponse}
                    multiline
                  />
                  <Text style={styles.label}>File URL (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="https://..."
                    placeholderTextColor={palette.subtext}
                    value={fileUrl}
                    onChangeText={setFileUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                  <KISButton
                    title="Submit Assignment"
                    variant="primary"
                    loading={submitting}
                    onPress={() => handleSubmit(item.id)}
                  />
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
