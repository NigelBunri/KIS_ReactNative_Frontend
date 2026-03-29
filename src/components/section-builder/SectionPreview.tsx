import React from 'react';
import { Animated, ImageBackground, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { resolveBackendAssetUrl } from '@/network';
import { resolveBackgroundColor } from './backgroundOptions';

import type { DynamicLandingSection } from './types';
import HeroSection from '@/components/sections/HeroSection';
import AboutSection from '@/components/sections/AboutSection';
import GallerySection from '@/components/sections/GallerySection';
import StatsSection from '@/components/sections/StatsSection';
import TestimonialsSection from '@/components/sections/TestimonialsSection';
import ProgramsSection from '@/components/sections/ProgramsSection';
import CTASection from '@/components/sections/CTASection';
import ContactSection from '@/components/sections/ContactSection';

type Props = {
  sections: DynamicLandingSection[];
  palette: any;
  typography: any;
  spacing: any;
  editable?: boolean;
  onEdit?: (sectionId: string) => void;
  onDelete?: (sectionId: string) => void;
};

const renderSection = (section: DynamicLandingSection, palette: any, typography: any, spacing: any) => {
  const props = { data: section.data, palette, typography, spacing };
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
    default:
      return null;
  }
};

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
                <Text style={{ ...typography.label, color: palette.subtext }}>
                  Section {index + 1}: {section.name || section.type}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TouchableOpacity onPress={() => onEdit?.(section.id)}>
                    <Text style={{ ...typography.label, color: palette.accentPrimary }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onDelete?.(section.id)}>
                    <Text style={{ ...typography.label, color: '#c0392b' }}>Delete</Text>
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

export default function SectionPreview({ sections, palette, typography, spacing, editable, onEdit, onDelete }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  if (!Array.isArray(sections) || sections.length === 0) {
    return (
      <View style={{ borderRadius: spacing.md, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, padding: spacing.md, marginTop: spacing.md }}>
        <Text style={{ ...typography.body, color: palette.subtext }}>No sections added yet. Use + Add New Section to begin.</Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: spacing.md, gap: spacing.md }}>
      {sections.map((section, index) => (
        <AnimatedSectionCard
          key={section.id}
          section={section}
          index={index}
          palette={palette}
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
