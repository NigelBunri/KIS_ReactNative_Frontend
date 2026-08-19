import React from 'react';
import { Animated, ImageBackground, Pressable, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { NestedReorderableList, useReorderableDrag } from 'react-native-reorderable-list';
import { resolveBackendAssetUrl } from '@/network';
import { resolveBackgroundColor } from './backgroundOptions';
import { KISIcon } from '@/constants/kisIcons';

import type { DynamicLandingSection } from './types';
import HeroSection from '@/components/sections/HeroSection';
import AboutSection from '@/components/sections/AboutSection';
import GallerySection from '@/components/sections/GallerySection';
import StatsSection from '@/components/sections/StatsSection';
import TestimonialsSection from '@/components/sections/TestimonialsSection';
import ProgramsSection from '@/components/sections/ProgramsSection';
import CTASection from '@/components/sections/CTASection';
import ContactSection from '@/components/sections/ContactSection';
import FaqsSection from '@/components/sections/FaqsSection';
import SocialLinksSection from '@/components/sections/SocialLinksSection';
import HoursSection from '@/components/sections/HoursSection';
import FormSection from '@/components/sections/FormSection';
import EmbedSection from '@/components/sections/EmbedSection';
import KisVideoSection from '@/components/sections/KisVideoSection';
import KisContentSection from '@/components/sections/KisContentSection';

type Props = {
  sections: DynamicLandingSection[];
  palette: any;
  typography: any;
  spacing: any;
  editable?: boolean;
  onEdit?: (sectionId: string) => void;
  onDelete?: (sectionId: string) => void;
  /** Enables press-and-hold drag reorder. Requires the list NOT be nested
   * inside another ScrollView (see WebsiteBuilderScreen, which restructures
   * around this for that reason) — reorderable lists own their own scroll. */
  reorderable?: boolean;
  onReorder?: (fromIndex: number, toIndex: number) => void;
};

function SectionDragHandle({ palette, spacing }: { palette: any; spacing: any }) {
  const drag = useReorderableDrag();
  return (
    <Pressable onLongPress={drag} hitSlop={10} style={{ paddingHorizontal: spacing.xs, paddingVertical: 2 }}>
      <KISIcon name="menu" size={18} color={palette.subtext} />
    </Pressable>
  );
}

const renderSection = (
  section: DynamicLandingSection,
  palette: any,
  typography: any,
  spacing: any,
  onFieldChange?: (key: string, value: string) => void,
) => {
  const props = { data: section.data, palette, typography, spacing, onFieldChange };
  switch (section.type) {
    case 'hero_banner':
      return <HeroSection {...props} />;
    case 'about':
      return <AboutSection {...props} />;
    case 'image_gallery_grid':
      return <GallerySection {...props} />;
    case 'statistics':
      return <StatsSection {...props} />;
    case 'testimonials':
      return <TestimonialsSection {...props} />;
    case 'programs_services':
      return <ProgramsSection {...props} />;
    case 'call_to_action':
      return <CTASection {...props} />;
    case 'contact_information':
      return <ContactSection {...props} />;
    case 'faqs':
      return <FaqsSection {...props} />;
    case 'social_links':
      return <SocialLinksSection {...props} />;
    case 'hours':
      return <HoursSection {...props} />;
    case 'form':
      return <FormSection {...props} />;
    case 'embed':
      return <EmbedSection {...props} />;
    case 'kis_video':
      return <KisVideoSection {...props} />;
    case 'kis_content':
      return <KisContentSection {...props} />;
    default:
      return null;
  }
};

/** Live-rendered preview of a section still being drafted (not yet saved
 * into `sections`) — same per-type components SectionPreview and the real
 * public page use, so what the owner sees while editing is what actually
 * ships, not a placeholder. Used by WebsiteBuilderScreen's split view. */
export function LiveSectionPreview({
  type, data, palette, typography, spacing, onDataChange,
}: {
  type: DynamicLandingSection['type'] | null;
  data: Record<string, any>;
  palette: any; typography: any; spacing: any;
  /** When provided, text fields render directly editable inside the
   * preview — typing there writes straight back into the same draft data
   * object the form below edits, so both stay in sync either way. */
  onDataChange?: (next: Record<string, any>) => void;
}) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const previewPalette = React.useMemo(() => buildPreviewPalette(palette, isDark), [isDark, palette]);
  const onFieldChange = onDataChange
    ? (key: string, value: string) => onDataChange({ ...data, [key]: value })
    : undefined;

  if (!type) return null;
  return (
    <View
      style={{
        marginTop: spacing.sm,
        borderRadius: spacing.md,
        borderWidth: 1,
        borderColor: previewPalette.divider,
        backgroundColor: previewPalette.card,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: previewPalette.divider }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: previewPalette.accentPrimary }} />
        <Text style={{ ...typography.label, color: previewPalette.subtext }}>Live Preview</Text>
        {onFieldChange ? (
          <Text style={{ ...typography.caption, color: previewPalette.subtext, marginLeft: 'auto' }}>Tap text to edit</Text>
        ) : null}
      </View>
      <View style={{ padding: spacing.sm }}>
        {renderSection({ id: 'draft', type, name: '', data } as DynamicLandingSection, previewPalette, typography, spacing, onFieldChange)}
      </View>
    </View>
  );
}

const buildPreviewPalette = (palette: any, isDark: boolean) => ({
  ...palette,
  onPrimary: '#FFFFFF',
  ivory: isDark ? '#E7C76D' : palette.ivory ?? '#FFF9EE',
  royalInk: isDark ? '#2B1605' : palette.royalInk ?? '#4B2F2A',
  danger: isDark ? '#FFB4A8' : palette.danger ?? '#B42318',
});

const AnimatedSectionCard = ({
  section,
  index,
  palette,
  typography,
  spacing,
  editable,
  onEdit,
  onDelete,
  isDark,
  dragHandle,
}: {
  section: DynamicLandingSection;
  index: number;
  palette: any;
  typography: any;
  spacing: any;
  editable?: boolean;
  onEdit?: (sectionId: string) => void;
  onDelete?: (sectionId: string) => void;
  isDark: boolean;
  dragHandle?: React.ReactNode;
}) => {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(12)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, delay: Math.min(index * 45, 220), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, delay: Math.min(index * 45, 220), useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
        marginTop: spacing.xs,
      }}
    >
      {(() => {
        const isHero = section.type === 'hero_banner';
        const sectionBackgroundImageUrl = (section?.data as any)?.sectionBackgroundImageUrl;
        const sectionBackgroundColorKey = (section?.data as any)?.sectionBackgroundColorKey;
        const sectionBgImage = sectionBackgroundImageUrl
          ? resolveBackendAssetUrl(sectionBackgroundImageUrl) || sectionBackgroundImageUrl
          : '';
        const sectionBgColor = isDark || !!sectionBgImage ? 'transparent' : resolveBackgroundColor(sectionBackgroundColorKey, palette.card);
        const content = (
          <View
            style={
              isHero
                ? undefined
                : {
                    borderRadius: spacing.md,
                    borderWidth: 1,
                    borderColor: palette.divider,
                    backgroundColor: sectionBgColor,
                    overflow: 'hidden',
                  }
            }
          >
            {!isHero && !!sectionBgImage ? (
              <ImageBackground
                source={{ uri: sectionBgImage }}
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
              />
            ) : null}
            <View style={isHero ? undefined : { padding: spacing.sm }}>
            {editable ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}>
                  {dragHandle}
                  <Text style={{ ...typography.label, color: palette.subtext }}>
                    Section {index + 1}: {section.name || section.type}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TouchableOpacity onPress={() => onEdit?.(section.id)}>
                    <Text style={{ ...typography.label, color: palette.accentPrimary }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onDelete?.(section.id)}>
                    <Text style={{ ...typography.label, color: palette.danger }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
            {renderSection(section, palette, typography, spacing)}
            </View>
          </View>
        );
        return content;
      })()}
    </Animated.View>
  );
};

export default function SectionPreview({ sections, palette, typography, spacing, editable, onEdit, onDelete, reorderable, onReorder }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const previewPalette = React.useMemo(() => buildPreviewPalette(palette, isDark), [isDark, palette]);

  if (!Array.isArray(sections) || sections.length === 0) {
    return (
      <View style={{ borderRadius: spacing.md, borderWidth: 1, borderColor: previewPalette.divider, backgroundColor: previewPalette.surface, padding: spacing.md, marginTop: spacing.md }}>
        <Text style={{ ...typography.body, color: previewPalette.subtext }}>No sections added yet. Use + Add New Section to begin.</Text>
      </View>
    );
  }

  if (reorderable && onReorder) {
    // Nested (not the page's own scroll) — WebsiteBuilderScreen wraps its
    // whole body in this library's <ScrollViewContainer> instead of a plain
    // ScrollView specifically so this can drag-reorder while living inside
    // the same page scroll as everything else around it.
    return (
      <NestedReorderableList
        data={sections}
        keyExtractor={(section) => section.id}
        onReorder={({ from, to }) => onReorder(from, to)}
        scrollable={false}
        contentContainerStyle={{ marginTop: spacing.md, gap: spacing.md }}
        renderItem={({ item: section, index }) => (
          <AnimatedSectionCard
            section={section}
            index={index}
            palette={previewPalette}
            typography={typography}
            spacing={spacing}
            editable={editable}
            onEdit={onEdit}
            onDelete={onDelete}
            isDark={isDark}
            dragHandle={<SectionDragHandle palette={previewPalette} spacing={spacing} />}
          />
        )}
      />
    );
  }

  return (
    <View style={{ marginTop: spacing.md, gap: spacing.md }}>
      {sections.map((section, index) => (
        <AnimatedSectionCard
          key={section.id}
          section={section}
          index={index}
          palette={previewPalette}
          typography={typography}
          spacing={spacing}
          editable={editable}
          onEdit={onEdit}
          onDelete={onDelete}
          isDark={isDark}
        />
      ))}
    </View>
  );
}
