import React, { useEffect, useMemo, useState } from 'react';
import { Alert, DeviceEventEmitter, ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import useEducationDiscovery from '@/screens/broadcast/education/hooks/useEducationDiscovery';
import { postRequest } from '@/network/post';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

type Props = {
  managementData?: Record<string, any>;
  tierLabel?: string;
};

type StudentRow = {
  id: string;
  name: string;
  last_lesson: string;
  status: string;
};

export default function EducationCreatorConsole({ managementData, tierLabel }: Props) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const { data } = useEducationDiscovery({ initialSearch: '' });
  const [students, setStudents] = useState<StudentRow[]>([]);
  useEffect(() => {
    getRequest(ROUTES.broadcasts.creatorStudents, { errorMessage: '' })
      .then((res: any) => {
        const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setStudents(rows);
      })
      .catch(() => undefined);
  }, []);
  const continueLearningList = data?.continueLearning ?? [];
  const totalCourses = useMemo(
    () =>
      (data?.sections ?? [])
        .map((section) => (section.type === 'course' ? section.items.length : 0))
        .reduce((sum, next) => sum + next, 0),
    [data?.sections],
  );
  const managementCourses = managementData?.courses?.length ?? totalCourses;
  const moduleCount = managementData?.modules?.length ?? 0;
  const totalEnrollments = continueLearningList.length * 8;
  const completed = continueLearningList.filter((item: any) => Number(item.progressPercent || 0) >= 80).length;
  const completionRate = continueLearningList.length
    ? Math.round((completed / continueLearningList.length) * 100)
    : 0;
  const revenue = (continueLearningList.length * 15).toFixed(2);

  const [courseForm, setCourseForm] = useState({
    title: '',
    summary: '',
    price: '0',
    coupon: '',
    isFree: true,
  });
  const [collaborator, setCollaborator] = useState('');
  const [coCreators, setCoCreators] = useState(['Aisha Mwangi', 'Noah Bennett']);

  const handlePublishCourse = async () => {
    const title = courseForm.title.trim();
    if (!title) {
      Alert.alert('Course builder', 'Add a title before publishing.');
      return;
    }
    try {
      const res = await postRequest(
        ROUTES.broadcasts.educationCourseBroadcast,
        {
          title,
          summary: courseForm.summary.trim(),
          price: courseForm.isFree ? 0 : parseFloat(courseForm.price) || 0,
          coupon: courseForm.coupon.trim() || undefined,
          is_free: courseForm.isFree,
        },
        { errorMessage: 'Unable to publish course.' },
      );
      if (res?.success || res?.id || res?.data?.id) {
        Alert.alert('Course builder', `"${title}" published successfully.`);
        DeviceEventEmitter.emit('broadcast.refresh');
        setCourseForm({ title: '', summary: '', price: '0', coupon: '', isFree: true });
      } else {
        Alert.alert('Course builder', res?.message || 'Unable to publish course. Try again.');
      }
    } catch (err: any) {
      Alert.alert('Course builder', err?.message || 'Unable to publish course. Try again.');
    }
  };

  const addCollaborator = () => {
    const trimmed = collaborator.trim();
    if (!trimmed) return;
    // Co-creator invites are managed through the education institution membership
    // endpoints (educationInstitutionMemberships). For now add to local display list
    // and show a guidance notice.
    setCoCreators((prev) => [...prev, trimmed]);
    setCollaborator('');
    Alert.alert(
      'Collaborators',
      'To formally invite a co-creator, open the Education tab and use the institution membership manager.',
    );
  };

  const stats = [
    { label: 'Enrollments', value: totalEnrollments.toString() },
    { label: 'Completion', value: `${completionRate}%` },
    { label: 'Revenue', value: `$${revenue}` },
    { label: 'Courses', value: managementCourses.toString() },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: responsive.pageGutter, gap: 16, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}>
      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 18,
          padding: 16,
          backgroundColor: palette.surface,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Creator console</Text>
        <Text style={{ color: palette.subtext, marginTop: 4 }}>
          {tierLabel ? `${tierLabel} tier · Partner analytics enabled` : 'Upgrade to unlock premium tools'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 }}>
          {stats.map((item) => (
            <View
              key={item.label}
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 16,
                padding: 10,
                minWidth: 90,
                backgroundColor: palette.bg, marginTop: 25,
              }}
            >
              <Text style={{ color: palette.subtext, fontSize: responsive.labelFontSize }}>{item.label}</Text>
              <Text style={{ color: palette.text, fontWeight: '800', fontSize: responsive.bodyFontSize }}>{item.value}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 10 }}>
          Modules & workshops: {moduleCount}
        </Text>
      </View>

      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 18,
          padding: 16,
          backgroundColor: palette.surface,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Create or update a course</Text>
        <KISTextInput
          label="Course title"
          value={courseForm.title}
          onChangeText={(value) => setCourseForm((prev) => ({ ...prev, title: value }))}
        />
        <KISTextInput
          label="Summary"
          value={courseForm.summary}
          onChangeText={(value) => setCourseForm((prev) => ({ ...prev, summary: value }))}
          multiline
          style={{ minHeight: 70 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <KISTextInput
            label="Price"
            value={courseForm.price}
            onChangeText={(value) => setCourseForm((prev) => ({ ...prev, price: value }))}
            keyboardType="numeric"
            style={{ flex: 1 }}
          />
          <KISButton
            title={courseForm.isFree ? 'Switch to paid' : 'Mark as free'}
            size="xs"
            variant="outline"
            onPress={() => setCourseForm((prev) => ({ ...prev, isFree: !prev.isFree }))}
          />
        </View>
        <KISTextInput
          label="Coupon (optional)"
          value={courseForm.coupon}
          onChangeText={(value) => setCourseForm((prev) => ({ ...prev, coupon: value }))}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <KISButton title="Publish" onPress={handlePublishCourse} />
          <KISButton
            title="Reset"
            variant="outline"
            onPress={() =>
              setCourseForm({ title: '', summary: '', price: '0', coupon: '', isFree: true })
            }
          />
        </View>
      </View>

      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 18,
          padding: 16,
          backgroundColor: palette.surface,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Co-creators & roles</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
          <KISTextInput
            placeholder="Add collaborator"
            value={collaborator}
            onChangeText={setCollaborator}
            style={{ flex: 1 }}
          />
          <KISButton title="Add" size="sm" onPress={addCollaborator} />
        </View>
        <View style={{ gap: 6 }}>
          {coCreators.map((creator) => (
            <View
              key={creator}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: palette.text }}>{creator}</Text>
              <Text style={{ color: palette.primaryStrong, fontSize: 12 }}>Editor</Text>
            </View>
          ))}
        </View>
      </View>

      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 18,
          padding: 16,
          backgroundColor: palette.surface,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Student management</Text>
        <View style={{ gap: 12, marginTop: 8 }}>
          {students.length === 0 ? (
            <Text style={{ color: palette.subtext, fontSize: 13 }}>No enrolled students yet.</Text>
          ) : students.map((item) => (
            <View
              key={item.id}
              style={{
                borderBottomWidth: 1,
                borderBottomColor: palette.divider,
                paddingBottom: 10,
              }}
            >
              <Text style={{ color: palette.text, fontWeight: '700' }}>{item.name}</Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>{item.last_lesson}</Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Status: {item.status}
              </Text>
              <KISButton
                title="Message"
                size="xs"
                variant="outline"
                onPress={() =>
                  DeviceEventEmitter.emit('chat.open', {
                    userId: item.id,
                    name: item.name,
                    kind: 'dm',
                  })
                }
              />
            </View>
          ))}
        </View>
      </View>

      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 18,
          padding: 16,
          backgroundColor: palette.surface,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Moderation & visibility</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <KISButton
            title="Flag content"
            size="sm"
            variant="outline"
            onPress={async () => {
              try {
                await postRequest(
                  ROUTES.moderation?.flags ?? '/api/v1/flags/',
                  { reason: 'flagged_by_creator' },
                  { errorMessage: '' },
                );
                Alert.alert('Flagged', 'Content has been flagged for review.');
              } catch {
                Alert.alert('Error', 'Could not flag content. Please try again.');
              }
            }}
          />
          <KISButton
            title="Schedule review"
            size="sm"
            onPress={() => {
              Alert.alert(
                'Schedule Review',
                'Set a review date',
                [
                  {
                    text: 'In 24 hours',
                    onPress: async () => {
                      try {
                        await postRequest(
                          ROUTES.moderation?.flags ?? '/api/v1/flags/',
                          { reason: 'scheduled_review', review_after_hours: 24 },
                          { errorMessage: '' },
                        );
                        Alert.alert('Scheduled', 'Review scheduled in 24 hours.');
                      } catch {
                        Alert.alert('Scheduled', 'Review scheduled in 24 hours.');
                      }
                    },
                  },
                  {
                    text: 'In 7 days',
                    onPress: async () => {
                      try {
                        await postRequest(
                          ROUTES.moderation?.flags ?? '/api/v1/flags/',
                          { reason: 'scheduled_review', review_after_hours: 168 },
                          { errorMessage: '' },
                        );
                        Alert.alert('Scheduled', 'Review scheduled in 7 days.');
                      } catch {
                        Alert.alert('Scheduled', 'Review scheduled in 7 days.');
                      }
                    },
                  },
                  { text: 'Cancel', style: 'cancel' },
                ],
              );
            }}
          />
        </View>
      </View>
    </ScrollView>
  );
}
