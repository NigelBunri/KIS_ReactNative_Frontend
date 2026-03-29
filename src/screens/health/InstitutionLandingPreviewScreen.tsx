import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ImageBackground,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useColorScheme,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';

import { RootStackParamList } from '@/navigation/types';
import { KISIcon } from '@/constants/kisIcons';
import {
  getHealthThemeBorders,
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import type { DynamicLandingSection } from '@/components/section-builder/types';
import { resolveBackendAssetUrl } from '@/network';
import { resolveBackgroundColor } from '@/components/section-builder/backgroundOptions';
import HeroSection from '@/components/sections/HeroSection';
import AboutSection from '@/components/sections/AboutSection';
import GallerySection from '@/components/sections/GallerySection';
import StatsSection from '@/components/sections/StatsSection';
import TestimonialsSection from '@/components/sections/TestimonialsSection';
import ProgramsSection from '@/components/sections/ProgramsSection';
import CTASection from '@/components/sections/CTASection';
import ContactSection from '@/components/sections/ContactSection';

type Props = NativeStackScreenProps<RootStackParamList, 'InstitutionLandingPreview'>;

const fromLegacy = (draft: any): DynamicLandingSection[] => {
  const sections: DynamicLandingSection[] = [];
  if (draft?.hero) {
    sections.push({
      id: 'legacy_hero',
      name: 'Hero Banner Section',
      type: 'hero_banner',
      data: {
        backgroundImageUrl: draft.hero.imageUrl || '',
        title: draft.hero.title || '',
        subtitle: draft.hero.slogan || '',
        ctaText: draft.hero.ctaLabel || 'Book Now',
        ctaLink: draft.hero.ctaUrl || '',
      },
    });
  }
  if (draft?.about) {
    sections.push({
      id: 'legacy_about',
      name: 'About Section',
      type: 'about',
      data: {
        title: 'About',
        description: draft.about,
        imageUrl: '',
        layout: 'image_left',
      },
    });
  }
  if (Array.isArray(draft?.gallery) && draft.gallery.length > 0) {
    sections.push({
      id: 'legacy_gallery',
      name: 'Image Gallery Grid',
      type: 'image_gallery_grid',
      data: {
        title: 'Gallery',
        images: draft.gallery,
        gridStyle: 'two_column',
      },
    });
  }
  if (draft?.contact) {
    sections.push({
      id: 'legacy_contact',
      name: 'Contact Information Section',
      type: 'contact_information',
      data: {
        title: 'Contact',
        phone: draft.contact.phone || '',
        email: draft.contact.email || '',
        address: draft.contact.address || '',
      },
    });
  }
  return sections;
};

const computeInstitutionInitials = (name: string) => {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'IN';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
};

export default function InstitutionLandingPreviewScreen({ navigation, route }: Props) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const borders = getHealthThemeBorders(palette);
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const draft = useMemo(() => route.params?.draft ?? {}, [route.params?.draft]);
  const institutionName = route.params?.institutionName ?? draft?.hero?.title ?? 'Institution';
  const scrollRef = useRef<ScrollView | null>(null);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);
  const [groupOffsets, setGroupOffsets] = useState<Record<string, number>>({});
  const [activeTabId, setActiveTabId] = useState<string>('');

  const sections = useMemo(() => {
    const explicit = Array.isArray(draft?.sections) ? (draft.sections as DynamicLandingSection[]) : [];
    if (explicit.length > 0) return explicit;
    return fromLegacy(draft);
  }, [draft]);
  const landingBackgroundImage = useMemo(
    () =>
      draft?.landingBackgroundImageUrl
        ? resolveBackendAssetUrl(draft.landingBackgroundImageUrl) || draft.landingBackgroundImageUrl
        : '',
    [draft?.landingBackgroundImageUrl],
  );
  const landingBackgroundColor = useMemo(
    () => resolveBackgroundColor(draft?.landingBackgroundColorKey, palette.background),
    [draft?.landingBackgroundColorKey, palette.background],
  );
  const effectiveLandingBackgroundColor = scheme === 'dark' ? 'transparent' : landingBackgroundColor;
  const landingLogo = useMemo(
    () => ((draft as any)?.landingLogoUrl ? resolveBackendAssetUrl((draft as any).landingLogoUrl) || (draft as any).landingLogoUrl : ''),
    [draft],
  );
  const logoFallbackText = useMemo(() => computeInstitutionInitials(institutionName), [institutionName]);

  const groupedSections = useMemo(() => {
    const groups: Array<{ id: string; name: string; sections: DynamicLandingSection[] }> = [];
    const indexByName: Record<string, number> = {};
    sections.forEach((section) => {
      const normalized = (section.name || section.type || 'Section').trim();
      const key = normalized.toLowerCase();
      if (typeof indexByName[key] === 'number') {
        groups[indexByName[key]].sections.push(section);
      } else {
        indexByName[key] = groups.length;
        groups.push({
          id: `group_${key.replace(/\s+/g, '_')}`,
          name: normalized,
          sections: [section],
        });
      }
    });
    return groups;
  }, [sections]);
  const startsWithHero = groupedSections[0]?.sections?.[0]?.type === 'hero_banner';

  React.useEffect(() => {
    if (!activeTabId && groupedSections.length > 0) {
      setActiveTabId(groupedSections[0].id);
    }
  }, [activeTabId, groupedSections]);

  const handlePressTab = (groupId: string) => {
    const targetY = groupOffsets[groupId] ?? 0;
    setActiveTabId(groupId);
    scrollRef.current?.scrollTo({
      y: Math.max(0, targetY - stickyHeaderHeight - spacing.sm),
      animated: true,
    });
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y + stickyHeaderHeight + spacing.sm;
    let nextActive = activeTabId;
    groupedSections.forEach((group) => {
      const top = groupOffsets[group.id];
      if (typeof top === 'number' && y >= top) {
        nextActive = group.id;
      }
    });
    if (nextActive !== activeTabId) {
      setActiveTabId(nextActive);
    }
  };

  const renderSection = (section: DynamicLandingSection) => {
    const props = { data: section.data, palette, typography, spacing };
    switch (section.type) {
      case 'hero_banner':
        return (
          <HeroSection
            {...props}
            onPressCta={() => {
              const targetInstitutionId = route.params?.institutionId;
              if (!targetInstitutionId) {
                Alert.alert('Book now', 'Institution scheduling is not available yet.');
                return;
              }
              navigation.navigate('HealthInstitutionCards', {
                institutionId: targetInstitutionId,
                institutionType: route.params?.institutionType,
                institutionName,
              });
            }}
          />
        );
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1 }}>
        <ImageBackground
          source={landingBackgroundImage ? { uri: landingBackgroundImage } : undefined}
          resizeMode="cover"
          style={{ flex: 1, backgroundColor: effectiveLandingBackgroundColor }}
        >
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            stickyHeaderIndices={[0]}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
          >
            <View
              onLayout={(event) => setStickyHeaderHeight(event.nativeEvent.layout.height)}
              style={{
                backgroundColor: `${palette.background}EE`,
                borderBottomWidth: 1,
                borderBottomColor: palette.divider,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.sm,
                paddingBottom: spacing.sm,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1, paddingRight: spacing.sm }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: palette.divider,
                      overflow: 'hidden',
                      backgroundColor: palette.card,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {landingLogo ? (
                      <ImageBackground source={{ uri: landingLogo }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Text style={{ ...typography.label, color: palette.text }}>{logoFallbackText}</Text>
                    )}
                  </View>
                  <Text numberOfLines={1} style={{ ...typography.caption, color: palette.subtext, flex: 1 }}>
                    {institutionName}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={{
                    ...borders.card,
                    borderWidth: 1,
                    borderColor: palette.divider,
                    borderRadius: 14,
                    padding: spacing.xs,
                    backgroundColor: palette.card,
                  }}
                >
                  <KISIcon name="close" size={18} color={palette.text} />
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.xs }}>
                {groupedSections.map((group) => {
                  const active = activeTabId === group.id;
                  return (
                    <TouchableOpacity
                      key={group.id}
                      onPress={() => handlePressTab(group.id)}
                      style={{
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? palette.accentPrimary : palette.divider,
                        backgroundColor: active ? `${palette.accentPrimary}22` : palette.card,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.xs,
                      }}
                    >
                      <Text style={{ ...typography.label, color: active ? palette.accentPrimary : palette.text }}>
                        {group.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={{ paddingHorizontal: spacing.lg, paddingTop: startsWithHero ? 0 : spacing.sm, paddingBottom: spacing.xl }}>
              {groupedSections.map((group) => (
                <View
                  key={group.id}
                  onLayout={(event) => {
                    const y = event.nativeEvent.layout.y;
                    setGroupOffsets((prev) => ({ ...prev, [group.id]: y }));
                  }}
                >
                  {group.sections.map((section, index) => {
                    const isHero = section.type === 'hero_banner';
                    const sectionBgImage = (section?.data as any)?.sectionBackgroundImageUrl
                      ? resolveBackendAssetUrl((section.data as any).sectionBackgroundImageUrl) ||
                        (section.data as any).sectionBackgroundImageUrl
                      : '';
                    const sectionBgColor =
                      scheme === 'dark' || !!sectionBgImage
                        ? 'transparent'
                        : resolveBackgroundColor(
                            (section?.data as any)?.sectionBackgroundColorKey,
                            palette.card,
                          );
                    const sectionInner = (
                      <View
                        style={
                          isHero
                            ? undefined
                            : {
                                borderRadius: spacing.md,
                                borderWidth: 1,
                                borderColor: palette.divider,
                                backgroundColor: sectionBgColor,
                                marginTop: spacing.md,
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
                          {renderSection(section)}
                        </View>
                      </View>
                    );
                    return (
                      <View
                        key={`${group.id}-${section.id}-${index}`}
                        style={isHero ? { marginHorizontal: -spacing.lg } : undefined}
                      >
                        {sectionInner}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </ImageBackground>
      </LinearGradient>
    </SafeAreaView>
  );
}
