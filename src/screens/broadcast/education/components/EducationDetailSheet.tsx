// src/screens/broadcast/education/components/EducationDetailSheet.tsx
import React from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { EducationContentItem, EducationCourse } from '@/screens/broadcast/education/api/education.models';

type Props = {
  visible: boolean;
  item: EducationContentItem | null;
  onClose: () => void;
  onEnroll: (item: EducationContentItem) => void;
  onPreview: (item: EducationContentItem) => void;
};

const renderSyllabus = (course?: EducationCourse) => {
  if (!course?.syllabus?.length) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontWeight: '700', marginBottom: 6 }}>Syllabus</Text>
      {course.syllabus.map((section) => (
        <Text key={section.id} style={{ color: '#555', fontSize: 12 }}>
          • {section.title}
        </Text>
      ))}
    </View>
  );
};

const renderOutcomes = (outcomes?: EducationCourse['outcomes']) => {
  if (!outcomes || outcomes.length === 0) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontWeight: '700', marginBottom: 6 }}>Outcomes</Text>
      {outcomes.map((outcome) => (
        <Text key={outcome.id} style={{ color: '#555', fontSize: 12 }}>
          • {outcome.label}
        </Text>
      ))}
    </View>
  );
};

const renderRequirements = (requirements?: EducationCourse['requirements']) => {
  if (!requirements || requirements.length === 0) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontWeight: '700', marginBottom: 6 }}>Requirements</Text>
      {requirements.map((req) => (
        <Text key={req.id} style={{ color: '#555', fontSize: 12 }}>
          • {req.label}
        </Text>
      ))}
    </View>
  );
};

export default function EducationDetailSheet({ visible, item, onClose, onEnroll, onPreview }: Props) {
  const { palette } = useKISTheme();

  if (!item) return null;

  const typeLabel = item.type.charAt(0).toUpperCase() + item.type.slice(1);

  const partnerLine = item.partnerName ?? (item as any).courses?.[0]?.partnerName ?? '';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: palette.backdrop }}>
        <View
          style={{
            marginTop: '30%',
            backgroundColor: palette.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 20,
            flex: 1,
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ color: palette.subtext }}>{typeLabel}</Text>
            <Text style={{ color: palette.text, fontWeight: '800', fontSize: 20, marginTop: 6 }}>
              {item.title}
            </Text>
            {partnerLine ? (
              <Text style={{ color: palette.primaryStrong, fontWeight: '600', marginBottom: 6 }}>
                {partnerLine}
              </Text>
            ) : null}
            {item.summary ? (
              <Text style={{ color: palette.subtext, marginBottom: 12 }}>{item.summary}</Text>
            ) : null}
            {renderSyllabus(item as EducationCourse)}
            {renderOutcomes((item as EducationCourse).outcomes)}
            {renderRequirements((item as EducationCourse).requirements)}
            {item instanceof Object ? (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontWeight: '700', marginBottom: 6 }}>Details</Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  Duration: {item.durationMinutes ?? 'TBD'} minutes
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  Level: {item.level ?? 'All levels'}
                </Text>
              </View>
            ) : null}
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              FAQs, reviews, and requirements are maintained on the creator dashboard for clarity.
            </Text>
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
            <KISButton title="Close" variant="secondary" onPress={onClose} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <KISButton title="Preview" size="sm" variant="outline" onPress={() => onPreview(item)} />
              <KISButton title="Enroll" size="sm" onPress={() => onEnroll(item)} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
