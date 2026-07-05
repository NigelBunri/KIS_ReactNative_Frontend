import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';

type Props = NativeStackScreenProps<RootStackParamList, 'LegalTemplates'>;

type LegalTemplate = {
  id: string;
  title: string;
  type: string;
  country: string;
  content: string;
};

export default function LegalTemplatesScreen(_props: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const gutter = layout.pageGutter;

  const [templates, setTemplates] = useState<LegalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [selectedTemplate, setSelectedTemplate] = useState<LegalTemplate | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.government.legalTemplates)
        .then((res: any) => {
          if (!active) return;
          setTemplates(Array.isArray(res) ? res : res?.results ?? []);
        })
        .catch(() => setTemplates([]))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const types = [
    'All',
    ...Array.from(new Set(templates.map((t) => t.type).filter(Boolean))),
  ];
  const countries = [
    'All',
    ...Array.from(new Set(templates.map((t) => t.country).filter(Boolean))),
  ];

  const filtered = templates.filter((t) => {
    const matchType = typeFilter === 'All' || t.type === typeFilter;
    const matchCountry = countryFilter === 'All' || t.country === countryFilter;
    return matchType && matchCountry;
  });

  function handleCopyText(content: string) {
    Clipboard.setString(content);
    Alert.alert('Copied', 'Template text copied to clipboard.');
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, marginTop: 25 }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, marginTop: 25 }]}>
      {/* Type Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { borderBottomColor: palette.divider }]}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: 8, gap: 8 }}
      >
        {types.map((t) => (
          <TouchableOpacity
            key={t}
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={[
              styles.chip,
              {
                backgroundColor:
                  typeFilter === t ? palette.primary : palette.surface,
                borderColor:
                  typeFilter === t ? palette.primary : palette.divider,
              },
            ]}
            onPress={() => setTypeFilter(t)}
          >
            <Text
              style={[
                styles.chipText,
                { color: typeFilter === t ? palette.ivory : palette.subtext },
              ]}
            >
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Country Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { borderBottomColor: palette.divider }]}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: 8, gap: 8 }}
      >
        {countries.map((c) => (
          <TouchableOpacity
            key={c}
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={[
              styles.chip,
              {
                backgroundColor:
                  countryFilter === c ? palette.primaryStrong : palette.surface,
                borderColor:
                  countryFilter === c ? palette.primaryStrong : palette.divider,
              },
            ]}
            onPress={() => setCountryFilter(c)}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color:
                    countryFilter === c ? palette.ivory : palette.subtext,
                },
              ]}
            >
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: 12,
          paddingBottom: 80,
        }}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <KISIcon name="clipboard-outline" size={52} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              No templates found
            </Text>
          </View>
        ) : (
          filtered.map((tmpl) => (
            <TouchableOpacity
              key={tmpl.id}
              activeOpacity={0.75}
              style={[
                styles.card,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.divider,
                  marginBottom: layout.cardGap,
                },
              ]}
              onPress={() => setSelectedTemplate(tmpl)}
            >
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  {tmpl.title}
                </Text>
                <View style={styles.badges}>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: palette.primarySoft },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: palette.primary }]}>
                      {tmpl.type}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: palette.surface, borderColor: palette.divider, borderWidth: 1 },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: palette.subtext }]}>
                      {tmpl.country}
                    </Text>
                  </View>
                </View>
              </View>
              <KISIcon
                name="chevron-forward-outline"
                size={18}
                color={palette.subtext}
              />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Template Detail Modal */}
      <Modal
        visible={!!selectedTemplate}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedTemplate(null)}
      >
        <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, marginTop: 25 }]}>
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: palette.divider, paddingHorizontal: gutter },
            ]}
          >
            <Text
              style={[styles.modalTitle, { color: palette.text, flex: 1 }]}
              numberOfLines={2}
            >
              {selectedTemplate?.title}
            </Text>
            <TouchableOpacity
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => setSelectedTemplate(null)}
            >
              <KISIcon name="close-outline" size={24} color={palette.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: gutter,
              paddingTop: 16,
              paddingBottom: 80,
            }}
          >
            <Text
              style={[styles.templateContent, { color: palette.text }]}
            >
              {selectedTemplate?.content}
            </Text>
          </ScrollView>

          <View
            style={[
              styles.modalFooter,
              { paddingHorizontal: gutter, borderTopColor: palette.divider },
            ]}
          >
            <KISButton
              title="Copy Text"
              onPress={() => handleCopyText(selectedTemplate?.content ?? '')}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filterBar: {
    borderBottomWidth: 1,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
  },
  cardContent: {
    flex: 1,
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  templateContent: {
    fontSize: 14,
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalFooter: {
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});
