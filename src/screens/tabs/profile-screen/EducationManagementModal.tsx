import React from 'react';
import { ScrollView, Text, View, Pressable, Alert } from 'react-native';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import type { KISPalette } from '@/theme/constants';
import { styles } from '../profile/profile.styles';
import { EDUCATION_MANAGEMENT_FEATURES } from './constants';
import type { EducationFormState } from './types';
import EducationCreatorConsole from '../profile/components/EducationCreatorConsole';
import { ManagementAttachments } from './ManagementAttachments';

export type EducationManagementModalProps = {
  palette: KISPalette;
  title: string;
  subtitle: string;
  managementData: any;
  tierLabel: string | null;
  courses: any[];
  modules: any[];
  educationForm: EducationFormState;
  educationFormMode: 'add' | 'edit';
  educationFormLoading: boolean;
  educationModuleForm: { title: string; summary: string; resource_url: string };
  educationModuleSubmitting: boolean;
  handleEducationFormSave: () => Promise<void>;
  handleEducationFormDelete: () => Promise<void>;
  resetEducationForm: () => void;
  handleEducationModuleSave: () => Promise<void>;
  resetEducationModuleForm: () => void;
  openModuleResource: (url?: string | null) => void;
  onEducationFormTitleChange: (value: string) => void;
  onEducationFormSummaryChange: (value: string) => void;
  onEducationModuleTitleChange: (value: string) => void;
  onEducationModuleSummaryChange: (value: string) => void;
  onEducationModuleResourceChange: (value: string) => void;
  loadEducationAnalytics: () => Promise<void>;
  educationAnalyticsLoading: boolean;
  educationAnalyticsError: string | null;
  upcomingLessons: any[];
  totalEnrollments: number;
  nextLesson: any | null;
  formatLessonTime: (value?: string | null) => string;
  attachments: any[];
  panelAttachmentUploading: boolean;
  handleAttachProfileFile: () => Promise<void>;
  onOpenLandingBuilder?: () => void;
};

export function EducationManagementModal(props: EducationManagementModalProps) {
  const {
    palette,
    title,
    subtitle,
    managementData,
    tierLabel,
    courses,
    modules,
    educationForm,
    educationFormMode,
    educationFormLoading,
    educationModuleForm,
    educationModuleSubmitting,
    handleEducationFormSave,
    handleEducationFormDelete,
    resetEducationForm,
    handleEducationModuleSave,
    resetEducationModuleForm,
    openModuleResource,
    onEducationFormTitleChange,
    onEducationFormSummaryChange,
    onEducationModuleTitleChange,
    onEducationModuleSummaryChange,
    onEducationModuleResourceChange,
    loadEducationAnalytics,
    educationAnalyticsLoading,
    educationAnalyticsError,
    upcomingLessons,
    totalEnrollments,
    nextLesson,
    formatLessonTime,
    attachments,
    panelAttachmentUploading,
    handleAttachProfileFile,
    onOpenLandingBuilder,
  } = props;

  const dangerColor = palette.danger ?? palette.primaryStrong;
  const extraCourses = Math.max(0, courses.length - 10);
  const creditUsage = extraCourses * 2;

  return (
    <ScrollView contentContainerStyle={styles.managementPanelBody}>
      <View>
        <Text style={[styles.managementPanelTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.managementPanelSubtitle, { color: palette.subtext }]}>{subtitle}</Text>
        {onOpenLandingBuilder ? (
          <View style={{ marginTop: 8 }}>
            <KISButton title="Manage Landing Page" size="sm" variant="outline" onPress={onOpenLandingBuilder} />
          </View>
        ) : null}
      </View>
      <EducationCreatorConsole managementData={managementData} tierLabel={tierLabel || undefined} />
      <View style={styles.managementStatsRow}>
        <View style={styles.managementStat}>
          <Text style={[styles.managementStatValue, { color: palette.text }]}>{courses.length}</Text>
          <Text style={[styles.managementStatLabel, { color: palette.subtext }]}>Courses</Text>
        </View>
        <View style={styles.managementStat}>
          <Text style={[styles.managementStatValue, { color: palette.text }]}>{creditUsage} credits</Text>
          <Text style={[styles.managementStatLabel, { color: palette.subtext }]}>Extra slots</Text>
        </View>
      </View>
      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          backgroundColor: palette.surface,
          borderRadius: 22,
          padding: 12,
          gap: 10,
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={[styles.managementFormLabel, { color: palette.text }]}>Learner insights</Text>
          <KISButton
            title="Refresh"
            size="xs"
            variant="outline"
            onPress={() => void loadEducationAnalytics()}
            disabled={educationAnalyticsLoading}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: palette.text, fontWeight: '900' }}>{upcomingLessons.length}</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>upcoming lessons</Text>
          </View>
          <View>
            <Text style={{ color: palette.text, fontWeight: '900' }}>{totalEnrollments}</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>total enrollments</Text>
          </View>
        </View>
        {educationAnalyticsLoading ? (
          <Text style={{ color: palette.subtext }}>Loading lesson data…</Text>
        ) : educationAnalyticsError ? (
          <Text style={{ color: dangerColor }}>{educationAnalyticsError}</Text>
        ) : nextLesson ? (
          <View>
            <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>
              Next lesson: {nextLesson.title}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              {formatLessonTime(nextLesson.starts_at)} · {nextLesson.enrollment_count ?? 0} enrollments
            </Text>
          </View>
        ) : (
          <Text style={{ color: palette.subtext }}>No upcoming lessons yet.</Text>
        )}
        {upcomingLessons.slice(0, 2).map((lesson, idx) => (
          <View
            key={`overview-lesson-${lesson.id ?? idx}`}
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 16,
              padding: 10,
              backgroundColor: palette.card,
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '700' }}>{lesson.title ?? 'Lesson'}</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              Starts {formatLessonTime(lesson.starts_at)} · {lesson.enrollment_count ?? 0} enrolled
            </Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <KISButton title="Plan lesson" onPress={() => Alert.alert('Lesson', 'Lesson scheduling tools coming soon (Phase 2).')} size="xs" />
          <KISButton
            title="Log recording"
            variant="outline"
            size="xs"
            onPress={() => Alert.alert('Recording', 'Live session capture will appear here once enabled.')}
          />
        </View>
      </View>
      <View style={{ gap: 10 }}>
        {courses.map((course, index) => (
          <View
            key={`${course.title}-${index}`}
            style={[
              styles.managementItemCard,
              { borderColor: palette.divider, backgroundColor: palette.surface },
            ]}
          >
            <Text style={[styles.managementItemTitle, { color: palette.text }]}>{course.title}</Text>
            <Text style={[styles.managementItemMeta, { color: palette.subtext }]}> 
              {course.summary || 'No summary provided'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => Alert.alert('Course', 'Course analytics opening…')}>
                <Text style={{ color: palette.primaryStrong }}>View analytics</Text>
              </Pressable>
              <Pressable onPress={() => Alert.alert('Learning', 'Learner roster updated.') }>
                <Text style={{ color: palette.primaryStrong }}>Manage learners</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              <KISButton
                size="xs"
                variant="outline"
                title="Edit"
                onPress={() => Alert.alert('Course', 'Edit course coming soon.')}
              />
            </View>
          </View>
        ))}
        <View style={[styles.managementFeatureList, { borderColor: palette.divider }]}> 
          {EDUCATION_MANAGEMENT_FEATURES.map((feature) => (
            <Text key={feature} style={[styles.managementFeatureItem, { color: palette.text }]}> 
              • {feature}
            </Text>
          ))}
        </View>
        <View
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            borderRadius: 22,
            padding: 12,
            backgroundColor: palette.surface,
            gap: 10,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Modules & workshops</Text>
          {modules.length === 0 ? (
            <Text style={{ color: palette.subtext }}>
              Add modules to keep learners on track and share resources with your broadcast.
            </Text>
          ) : (
            modules.map((module, index) => (
              <View
                key={`module-${module.id ?? index}`}
                style={{
                  borderWidth: 2,
                  borderColor: palette.divider,
                  borderRadius: 16,
                  padding: 10,
                  backgroundColor: palette.card,
                  gap: 6,
                }}
              >
                <Text style={{ color: palette.text, fontWeight: '900' }}>{module.title || 'Module'}</Text>
                {module.summary ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }} numberOfLines={2}>
                    {module.summary}
                  </Text>
                ) : null}
                {module.resource_url ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <KISButton
                      title="Open resource"
                      variant="outline"
                      size="xs"
                      onPress={() => openModuleResource(module.resource_url)}
                    />
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      {module.resource_url}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>Resource link pending.</Text>
                )}
              </View>
            ))
          )}
        </View>
      </View>
      <View
        style={[
          styles.managementForm,
          { borderColor: palette.divider, backgroundColor: palette.card },
        ]}
      >
        <Text style={[styles.managementFormLabel, { color: palette.text }]}> 
          {educationFormMode === 'edit' ? 'Update course' : 'Add course'}
        </Text>
        <KISTextInput
          label="Course title"
          value={educationForm.title}
          onChangeText={onEducationFormTitleChange}
        />
        <KISTextInput
          label="Summary"
          value={educationForm.summary}
          onChangeText={onEducationFormSummaryChange}
          multiline
          style={{ minHeight: 80 }}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <KISButton
            title={educationFormMode === 'edit' ? 'Update course' : 'Add course'}
            onPress={handleEducationFormSave}
            disabled={educationFormLoading}
          />
          {educationFormMode === 'edit' && (
            <KISButton
              title="Delete course"
              variant="outline"
              onPress={handleEducationFormDelete}
              disabled={educationFormLoading}
            />
          )}
        </View>
        <KISButton
          title="Reset form"
          variant="secondary"
          onPress={resetEducationForm}
          disabled={educationFormLoading}
        />
      </View>
      <View
        style={[
          styles.managementForm,
          { borderColor: palette.divider, backgroundColor: palette.surface },
        ]}
      >
        <Text style={[styles.managementFormLabel, { color: palette.text }]}>Add module</Text>
        <KISTextInput
          label="Module title"
          value={educationModuleForm.title}
          onChangeText={onEducationModuleTitleChange}
        />
        <KISTextInput
          label="Summary"
          value={educationModuleForm.summary}
          onChangeText={onEducationModuleSummaryChange}
          multiline
          style={{ minHeight: 70 }}
        />
        <KISTextInput
          label="Resource URL"
          value={educationModuleForm.resource_url}
          onChangeText={onEducationModuleResourceChange}
          autoCapitalize="none"
          keyboardType="url"
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <KISButton
            title="Add module"
            onPress={handleEducationModuleSave}
            disabled={educationModuleSubmitting}
          />
          <KISButton
            title="Reset form"
            variant="secondary"
            onPress={resetEducationModuleForm}
            disabled={educationModuleSubmitting}
          />
        </View>
      </View>
      <ManagementAttachments
        palette={palette}
        attachments={attachments}
        uploading={panelAttachmentUploading}
        onAddAttachment={handleAttachProfileFile}
      />
      <View style={styles.managementActionRow}>
        <KISButton
          title="Send learning reminder"
          onPress={() => Alert.alert('Education', 'Reminder sent.')}
        />
        <KISButton
          title="Plan live session"
          variant="outline"
          onPress={() => Alert.alert('Education', 'Live session planning coming soon.')}
        />
      </View>
    </ScrollView>
  );
}
