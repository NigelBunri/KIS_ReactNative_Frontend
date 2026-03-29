import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import { KISIcon } from '@/constants/kisIcons';
import {
  getHealthThemeBorders,
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import {
  HEALTH_DASHBOARD_INSTITUTION_TYPES,
  type HealthDashboardInstitutionType,
  type InstitutionProfileEditorDraft,
} from '@/features/health-dashboard/models';
import {
  ensureInstitutionDashboardExists,
  fetchInstitutionLandingPage,
  fetchInstitutionProfileEditor,
  upsertInstitutionLandingPage,
  updateInstitutionProfileEditor,
  uploadHealthDashboardImage,
} from '@/services/healthDashboardService';
import SectionTypeSelector from '@/components/section-builder/SectionTypeSelector';
import DynamicSectionForm from '@/components/section-builder/DynamicSectionForm';
import SectionPreview from '@/components/section-builder/SectionPreview';
import { SECTION_TYPE_META } from '@/components/section-builder/sectionTypeMeta';
import BackgroundColorSelector from '@/components/section-builder/BackgroundColorSelector';
import {
  createEmptySectionData,
  createSection,
  type DynamicLandingSection,
  type SectionType,
} from '@/components/section-builder/types';
import { resolveBackgroundColor } from '@/components/section-builder/backgroundOptions';

const buildInstitutionServicesCtaUrl = (institutionId: string) =>
  `kis://health/institutions/${encodeURIComponent(institutionId)}/services`;

const isSupportedType = (value: string): value is HealthDashboardInstitutionType =>
  HEALTH_DASHBOARD_INSTITUTION_TYPES.includes(value as HealthDashboardInstitutionType);

const createDefaultDraft = (_institutionType: HealthDashboardInstitutionType): InstitutionProfileEditorDraft => ({
  isPublished: false,
  hero: {
    imageUrl: '',
    title: '',
    slogan: '',
    ctaLabel: 'Book Now',
    ctaUrl: '',
  },
  about: '',
  gallery: [],
  servicesVisibility: {},
  staffDisplayEnabled: true,
  certifications: [],
  faqs: [],
  seo: {
    title: '',
    description: '',
    keywords: [],
  },
  contact: {
    phone: '',
    email: '',
    address: '',
  },
  socialLinks: [],
  emergencyBanner: {
    enabled: false,
    message: '',
  },
  operatingHours: [],
  pricingVisibilityEnabled: true,
  landingBackgroundImageUrl: '',
  landingBackgroundColorKey: 'ocean_mist',
  sections: [],
});

const normalizeSections = (draft: InstitutionProfileEditorDraft): DynamicLandingSection[] => {
  const fromDraft = Array.isArray(draft?.sections) ? draft.sections : [];
  if (fromDraft.length > 0) return fromDraft as DynamicLandingSection[];

  const sections: DynamicLandingSection[] = [];

  if (draft?.hero) {
    sections.push({
      id: `legacy_hero_${Date.now()}`,
      name: 'Hero Banner',
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
      id: `legacy_about_${Date.now()}`,
      name: 'About',
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
      id: `legacy_gallery_${Date.now()}`,
      name: 'Gallery',
      type: 'image_gallery_grid',
      data: {
        title: 'Gallery',
        images: draft.gallery,
        gridStyle: 'two_column',
      },
    });
  }
  if (draft?.contact && (draft.contact.phone || draft.contact.email || draft.contact.address)) {
    sections.push({
      id: `legacy_contact_${Date.now()}`,
      name: 'Contact',
      type: 'contact_information',
      data: {
        title: 'Contact Information',
        phone: draft.contact.phone || '',
        email: draft.contact.email || '',
        address: draft.contact.address || '',
      },
    });
  }

  return sections;
};

const mergeLegacyCompatibility = (base: InstitutionProfileEditorDraft, sections: DynamicLandingSection[]) => {
  const hero = sections.find((section) => section.type === 'hero_banner');
  const about = sections.find((section) => section.type === 'about');
  const gallery = sections.find((section) => section.type === 'image_gallery_grid');
  const contact = sections.find((section) => section.type === 'contact_information');

  return {
    ...base,
    sections,
    hero: hero
      ? {
          imageUrl: String((hero.data as any)?.backgroundImageUrl || ''),
          title: String((hero.data as any)?.title || ''),
          slogan: String((hero.data as any)?.subtitle || ''),
          ctaLabel: String((hero.data as any)?.ctaText || 'Book Now'),
          ctaUrl: String((hero.data as any)?.ctaLink || ''),
        }
      : base.hero,
    about: about ? String((about.data as any)?.description || '') : base.about,
    gallery: gallery ? (Array.isArray((gallery.data as any)?.images) ? (gallery.data as any).images : []) : base.gallery,
    contact: contact
      ? {
          phone: String((contact.data as any)?.phone || ''),
          email: String((contact.data as any)?.email || ''),
          address: String((contact.data as any)?.address || ''),
        }
      : base.contact,
  };
};

const hasDraftContent = (value: any) =>
  !!(value && typeof value === 'object' && Object.keys(value).length > 0);

export default function InstitutionProfileEditorScreen({ navigation, route }: any) {
  const institutionId = route?.params?.institutionId as string | undefined;
  const institutionType = route?.params?.institutionType as string | undefined;

  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const borders = getHealthThemeBorders(palette);
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const dashboardType = useMemo(() => {
    if (!isSupportedType(String(institutionType ?? ''))) return null;
    return institutionType as HealthDashboardInstitutionType;
  }, [institutionType]);

  const generatedCtaUrl = useMemo(
    () => (institutionId ? buildInstitutionServicesCtaUrl(institutionId) : ''),
    [institutionId],
  );
  const localBuilderCacheKey = useMemo(
    () => (institutionId ? `kis_dynamic_section_builder_draft_v1:${institutionId}` : ''),
    [institutionId],
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPublishState, setSavingPublishState] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingLandingImage, setUploadingLandingImage] = useState(false);
  const [uploadingLandingLogo, setUploadingLandingLogo] = useState(false);
  const [draft, setDraft] = useState<InstitutionProfileEditorDraft | null>(null);
  const [landingPublished, setLandingPublished] = useState(false);
  const [sections, setSections] = useState<DynamicLandingSection[]>([]);
  const [selectedType, setSelectedType] = useState<SectionType | null>(null);
  const [sectionDraftName, setSectionDraftName] = useState('');
  const [sectionDraftData, setSectionDraftData] = useState<Record<string, any>>({});
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [isSectionTypePickerOpen, setIsSectionTypePickerOpen] = useState(false);
  const [isLandingStylePickerOpen, setIsLandingStylePickerOpen] = useState(false);
  const editorScrollRef = useRef<ScrollView | null>(null);
  const [formAreaY, setFormAreaY] = useState(0);

  const loadDraft = useCallback(async () => {
    if (!institutionId || !dashboardType) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const fallback = createDefaultDraft(dashboardType);
      const fallbackWithCta: InstitutionProfileEditorDraft = {
        ...fallback,
        hero: {
          ...fallback.hero,
          ctaUrl: generatedCtaUrl || fallback.hero.ctaUrl,
        },
      };

      const bootstrap = await ensureInstitutionDashboardExists(institutionId, dashboardType);
      if (!bootstrap?.success) throw new Error(bootstrap?.message || 'Unable to initialize institution dashboard.');

      const [res, landingRes] = await Promise.all([
        fetchInstitutionProfileEditor(institutionId),
        fetchInstitutionLandingPage(institutionId),
      ]);
      if (!res?.success && Number(res?.status) !== 404) {
        throw new Error(res?.message || 'Unable to load profile editor data.');
      }

      const payload = res?.data ?? res ?? {};
      const existingFromEditor = payload?.profile_editor ?? payload?.draft ?? payload;
      const landingDraft =
        landingRes?.success && landingRes?.data?.draft && typeof landingRes.data.draft === 'object'
          ? landingRes.data.draft
          : null;
      const existing = hasDraftContent(existingFromEditor)
        ? existingFromEditor
        : hasDraftContent(landingDraft)
          ? landingDraft
          : existingFromEditor;
      const publishedFromLanding = landingRes?.success ? !!landingRes?.data?.isPublished : null;
      const publishedFromDraft = typeof existing?.isPublished === 'boolean' ? existing.isPublished : null;
      const effectivePublished = publishedFromLanding ?? publishedFromDraft ?? false;
      setLandingPublished(effectivePublished);

      const hydrated: InstitutionProfileEditorDraft = {
        ...fallbackWithCta,
        ...(existing || {}),
        isPublished: effectivePublished,
        hero: {
          ...fallbackWithCta.hero,
          ...(existing?.hero || {}),
          ctaUrl: generatedCtaUrl || existing?.hero?.ctaUrl || fallbackWithCta.hero.ctaUrl,
        },
        contact: {
          ...fallbackWithCta.contact,
          ...(existing?.contact || {}),
        },
        landingBackgroundImageUrl:
          (existing?.landingBackgroundImageUrl || '') as string,
        landingBackgroundColorKey:
          (existing?.landingBackgroundColorKey || 'ocean_mist') as string,
      };

      const nextSections = normalizeSections(hydrated);
      let cachedSections: DynamicLandingSection[] | null = null;
      if (localBuilderCacheKey) {
        try {
          const raw = await AsyncStorage.getItem(localBuilderCacheKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.sections)) {
              cachedSections = parsed.sections as DynamicLandingSection[];
            }
          }
        } catch {
          // ignore cache read issues
        }
      }
      setDraft(hydrated);
      setSections(cachedSections && cachedSections.length > 0 ? cachedSections : nextSections);
    } catch (error: any) {
      Alert.alert('Profile editor', error?.message || 'Unable to load profile editor data.');
      const fallback = createDefaultDraft(dashboardType);
      const fallbackWithCta: InstitutionProfileEditorDraft = {
        ...fallback,
        hero: {
          ...fallback.hero,
          ctaUrl: generatedCtaUrl || fallback.hero.ctaUrl,
        },
      };
      setDraft(fallbackWithCta);
      setLandingPublished(false);
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [dashboardType, generatedCtaUrl, institutionId, localBuilderCacheKey]);

  useEffect(() => {
    loadDraft().catch(() => {});
  }, [loadDraft]);

  useEffect(() => {
    if (!selectedType) {
      setSectionDraftData({});
      setSectionDraftName('');
      return;
    }
    setSectionDraftData(createEmptySectionData(selectedType));
    const defaultName = SECTION_TYPE_META.find((item) => item.type === selectedType)?.title || '';
    setSectionDraftName(defaultName);
  }, [selectedType]);

  const selectedSectionTypeLabel = useMemo(() => {
    if (!selectedType) return 'Select section type';
    return SECTION_TYPE_META.find((item) => item.type === selectedType)?.title || 'Select section type';
  }, [selectedType]);

  useEffect(() => {
    if (!localBuilderCacheKey) return;
    const persist = async () => {
      try {
        await AsyncStorage.setItem(
          localBuilderCacheKey,
          JSON.stringify({
            sections,
            selectedType,
            sectionDraftData,
            updatedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // ignore cache write issues
      }
    };
    persist().catch(() => {});
  }, [localBuilderCacheKey, sectionDraftData, sections, selectedType]);

  const handlePickSingleImage = useCallback(async () => {
    if (!selectedType) return;
    setUploadingImage(true);
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      let url = asset.uri;
      try {
        const uploaded = await uploadHealthDashboardImage(asset, 'health_dashboard_section');
        const remote =
          uploaded?.url ??
          uploaded?.uri ??
          uploaded?.file_url ??
          uploaded?.fileUrl ??
          uploaded?.path;
        if (remote) url = String(remote);
      } catch {
        // keep local uri fallback for immediate preview
      }

      if (selectedType === 'hero_banner') {
        setSectionDraftData((prev) => ({ ...prev, backgroundImageUrl: url }));
      } else if (selectedType === 'about') {
        setSectionDraftData((prev) => ({ ...prev, imageUrl: url }));
      }
    } catch (error: any) {
      Alert.alert('Profile editor', error?.message || 'Unable to pick image.');
    } finally {
      setUploadingImage(false);
    }
  }, [selectedType]);

  const handlePickSectionBackgroundImage = useCallback(async () => {
    if (!selectedType) return;
    setUploadingImage(true);
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      let url = asset.uri;
      try {
        const uploaded = await uploadHealthDashboardImage(asset, 'health_dashboard_section_background');
        const remote = uploaded?.url ?? uploaded?.uri ?? uploaded?.file_url ?? uploaded?.fileUrl ?? uploaded?.path;
        if (remote) url = String(remote);
      } catch {
        // keep local uri fallback
      }

      setSectionDraftData((prev) => ({ ...prev, sectionBackgroundImageUrl: url }));
    } catch (error: any) {
      Alert.alert('Profile editor', error?.message || 'Unable to pick section background image.');
    } finally {
      setUploadingImage(false);
    }
  }, [selectedType]);

  const handleRemoveSectionBackgroundImage = useCallback(() => {
    setSectionDraftData((prev) => ({ ...prev, sectionBackgroundImageUrl: '' }));
  }, []);

  const handlePickGalleryImage = useCallback(async () => {
    if (selectedType !== 'image_gallery_grid') return;
    setUploadingImage(true);
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      let url = asset.uri;
      try {
        const uploaded = await uploadHealthDashboardImage(asset, 'health_dashboard_gallery');
        const remote =
          uploaded?.url ??
          uploaded?.uri ??
          uploaded?.file_url ??
          uploaded?.fileUrl ??
          uploaded?.path;
        if (remote) url = String(remote);
      } catch {
        // keep local uri fallback for immediate preview
      }

      setSectionDraftData((prev) => ({
        ...prev,
        images: [...(Array.isArray(prev?.images) ? prev.images : []), url],
      }));
    } catch (error: any) {
      Alert.alert('Profile editor', error?.message || 'Unable to pick image.');
    } finally {
      setUploadingImage(false);
    }
  }, [selectedType]);

  const handlePickLandingBackgroundImage = useCallback(async () => {
    setUploadingLandingImage(true);
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      let url = asset.uri;
      try {
        const uploaded = await uploadHealthDashboardImage(asset, 'health_dashboard_landing_background');
        const remote = uploaded?.url ?? uploaded?.uri ?? uploaded?.file_url ?? uploaded?.fileUrl ?? uploaded?.path;
        if (remote) url = String(remote);
      } catch {
        // keep local uri fallback
      }

      setDraft((prev) => (prev ? { ...prev, landingBackgroundImageUrl: url } : prev));
    } catch (error: any) {
      Alert.alert('Profile editor', error?.message || 'Unable to pick landing background image.');
    } finally {
      setUploadingLandingImage(false);
    }
  }, []);

  const handlePickLandingLogo = useCallback(async () => {
    setUploadingLandingLogo(true);
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      let url = asset.uri;
      try {
        const uploaded = await uploadHealthDashboardImage(asset, 'health_dashboard_landing_logo');
        const remote = uploaded?.url ?? uploaded?.uri ?? uploaded?.file_url ?? uploaded?.fileUrl ?? uploaded?.path;
        if (remote) url = String(remote);
      } catch {
        // keep local uri fallback
      }

      setDraft((prev) => (prev ? { ...prev, landingLogoUrl: url } : prev));
    } catch (error: any) {
      Alert.alert('Profile editor', error?.message || 'Unable to pick landing page logo.');
    } finally {
      setUploadingLandingLogo(false);
    }
  }, []);

  const handleAddSection = useCallback(() => {
    if (!selectedType) {
      Alert.alert('Sections', 'Select a section type first.');
      return;
    }
    if (editingSectionId) {
      setSections((prev) =>
        prev.map((section) => {
          if (section.id !== editingSectionId) return section;
          const meta = SECTION_TYPE_META.find((item) => item.type === selectedType);
          return {
            ...section,
            name: (sectionDraftName || '').trim() || meta?.title || section.name,
            type: selectedType,
            data: { ...createEmptySectionData(selectedType), ...sectionDraftData } as any,
          };
        }),
      );
    } else {
      const created = createSection(selectedType);
      const meta = SECTION_TYPE_META.find((item) => item.type === selectedType);
      created.name = (sectionDraftName || '').trim() || meta?.title || created.name;
      created.data = { ...created.data, ...sectionDraftData } as any;
      setSections((prev) => [...prev, created]);
    }
    setEditingSectionId(null);
    setSelectedType(null);
    setSectionDraftName('');
    setSectionDraftData({});
  }, [editingSectionId, sectionDraftData, sectionDraftName, selectedType]);

  const handleEditSection = useCallback((sectionId: string) => {
    const current = sections.find((item) => item.id === sectionId);
    if (!current) return;
    setEditingSectionId(current.id);
    setSelectedType(current.type);
    setSectionDraftName(current.name || '');
    setSectionDraftData({ ...(current.data || {}) });
    setIsSectionTypePickerOpen(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        editorScrollRef.current?.scrollTo({
          y: Math.max(formAreaY - spacing.md, 0),
          animated: true,
        });
      });
    });
  }, [formAreaY, sections, spacing.md]);

  const handleDeleteSection = useCallback((sectionId: string) => {
    Alert.alert('Delete section', 'Are you sure you want to delete this section?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSections((prev) => prev.filter((section) => section.id !== sectionId));
          if (editingSectionId === sectionId) {
            setEditingSectionId(null);
            setSelectedType(null);
            setSectionDraftName('');
            setSectionDraftData({});
          }
        },
      },
    ]);
  }, [editingSectionId]);

  const handleSelectSectionType = useCallback((type: SectionType) => {
    setSelectedType(type);
    setIsSectionTypePickerOpen(false);
  }, []);

  const handleSavePublishState = useCallback(async () => {
    if (!institutionId) return;
    setSavingPublishState(true);
    try {
      const response = await upsertInstitutionLandingPage(institutionId, {
        isPublished: landingPublished,
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to update publish status.');
      }
      const effectivePublished = !!response?.data?.isPublished;
      setLandingPublished(effectivePublished);
      setDraft((prev) => (prev ? { ...prev, isPublished: effectivePublished } : prev));
      Alert.alert(
        'Profile editor',
        effectivePublished
          ? 'Landing page is now published. Health card titles are clickable.'
          : 'Landing page is now unpublished. Health card titles are not clickable.',
      );
    } catch (error: any) {
      Alert.alert('Profile editor', error?.message || 'Unable to update publish status.');
    } finally {
      setSavingPublishState(false);
    }
  }, [institutionId, landingPublished]);

  const handleSave = useCallback(async () => {
    if (!institutionId || !draft) return;
    setSaving(true);
    try {
      const payload = mergeLegacyCompatibility(
        {
          ...draft,
          isPublished: landingPublished,
          hero: {
            ...draft.hero,
            ctaUrl: generatedCtaUrl || draft.hero.ctaUrl,
          },
          landingBackgroundImageUrl: draft.landingBackgroundImageUrl || '',
          landingBackgroundColorKey: draft.landingBackgroundColorKey || '',
          landingLogoUrl: (draft as any).landingLogoUrl || '',
        },
        sections,
      );

      const res = await updateInstitutionProfileEditor(institutionId, payload);
      if (!res?.success) throw new Error(res?.message || 'Unable to save profile editor draft.');
      const publishRes = await upsertInstitutionLandingPage(institutionId, {
        isPublished: landingPublished,
      });
      if (publishRes?.success && publishRes?.data) {
        const effectivePublished = !!publishRes.data.isPublished;
        setLandingPublished(effectivePublished);
        payload.isPublished = effectivePublished;
      }
      setDraft(payload);
      if (localBuilderCacheKey) {
        await AsyncStorage.removeItem(localBuilderCacheKey);
      }
      Alert.alert('Profile editor', 'Dynamic landing sections saved.');
    } catch (error: any) {
      Alert.alert('Profile editor', error?.message || 'Unable to save profile editor draft.');
    } finally {
      setSaving(false);
    }
  }, [draft, generatedCtaUrl, institutionId, landingPublished, localBuilderCacheKey, sections]);

  const handleOpenLandingPreview = useCallback(() => {
    if (!dashboardType) return;
    navigation.navigate('InstitutionLandingPreview', {
      institutionId,
      institutionType: dashboardType,
      institutionName: draft?.hero?.title || undefined,
      draft: {
        ...(draft || {}),
        isPublished: landingPublished,
        sections,
      },
    });
  }, [dashboardType, draft, institutionId, landingPublished, navigation, sections]);

  if (!dashboardType) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1, padding: spacing.lg }}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ ...typography.h2, color: palette.text }}>Unsupported Institution Type</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.sm }}>
              Profile editor supports only clinic, hospital, lab, diagnostics, pharmacy, and wellness center.
            </Text>
            <View style={{ marginTop: spacing.lg }}>
              <KISButton title="Back to dashboard" onPress={() => navigation.goBack()} />
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (loading || !draft) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={palette.accentPrimary} />
          <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.sm }}>Loading profile editor...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1 }}>
        <View style={{ alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 12,
              padding: spacing.xs,
              backgroundColor: palette.card,
            }}
            accessibilityLabel="Close profile editor"
          >
            <KISIcon name="close" size={18} color={palette.text} />
          </TouchableOpacity>
        </View>

        <ScrollView ref={editorScrollRef} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
          <View style={{ borderRadius: spacing.lg, padding: spacing.md, backgroundColor: palette.card, ...borders.card }}>
            <Text style={{ ...typography.h2, color: palette.text }}>Institution Profile Editor</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
              Dynamic Section Builder with live preview.
            </Text>

            <View
              style={{
                marginTop: spacing.md,
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: spacing.md,
                backgroundColor: palette.surface,
                padding: spacing.sm,
              }}
            >
              <Text style={{ ...typography.h3, color: palette.text }}>Landing Page Visibility</Text>
              <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
                {landingPublished
                  ? 'Published: health card titles link to this landing page.'
                  : 'Unpublished: health card titles are not clickable.'}
              </Text>
              <View style={{ marginTop: spacing.sm, flexDirection: 'row', gap: spacing.xs }}>
                <KISButton
                  title="Published"
                  size="sm"
                  variant={landingPublished ? 'primary' : 'outline'}
                  onPress={() => setLandingPublished(true)}
                  disabled={savingPublishState || saving}
                />
                <KISButton
                  title="Unpublished"
                  size="sm"
                  variant={!landingPublished ? 'primary' : 'outline'}
                  onPress={() => setLandingPublished(false)}
                  disabled={savingPublishState || saving}
                />
              </View>
              <View style={{ marginTop: spacing.sm }}>
                <KISButton
                  title={savingPublishState ? 'Saving Publish Status...' : 'Save Publish Status'}
                  onPress={() => {
                    handleSavePublishState().catch(() => undefined);
                  }}
                  disabled={savingPublishState || saving}
                />
              </View>
            </View>

            <Text style={{ ...typography.h3, color: palette.text, marginTop: spacing.md }}>Live Landing Preview</Text>
            <TouchableOpacity
              onPress={() => setIsLandingStylePickerOpen((prev) => !prev)}
              style={{
                marginTop: spacing.sm,
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: spacing.md,
                backgroundColor: resolveBackgroundColor(draft?.landingBackgroundColorKey, palette.card),
                padding: spacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.caption, color: palette.subtext }}>Landing Page Styling</Text>
                <Text style={{ ...typography.label, color: palette.text, marginTop: 2 }}>
                  {isLandingStylePickerOpen ? 'Hide options' : 'Expand options'}
                </Text>
              </View>
              <KISIcon name="chevron-down" size={16} color={palette.subtext} />
            </TouchableOpacity>

            {isLandingStylePickerOpen ? (
              <View
                style={{
                  marginTop: spacing.sm,
                  borderWidth: 1,
                  borderColor: palette.divider,
                  borderRadius: spacing.md,
                  backgroundColor: palette.card,
                  padding: spacing.sm,
                }}
              >
                <Text style={{ ...typography.label, color: palette.text }}>Landing Page Background & Logo</Text>
                <View style={{ marginTop: spacing.xs, flexDirection: 'column', gap: spacing.sm }}>
                  <KISButton
                    title={uploadingLandingImage ? 'Selecting Image...' : 'Select Landing Background Image'}
                    variant="outline"
                    onPress={handlePickLandingBackgroundImage}
                    disabled={saving || uploadingLandingImage}
                  />
                  <KISButton
                    title="Remove Background Image"
                    variant="outline"
                    onPress={() => setDraft((prev) => (prev ? { ...prev, landingBackgroundImageUrl: '' } : prev))}
                    disabled={saving || uploadingLandingImage || !draft?.landingBackgroundImageUrl}
                  />
                </View>
                <KISTextInput
                  label="Landing Background Image URL"
                  value={String(draft?.landingBackgroundImageUrl || '')}
                  editable={false}
                  style={{ marginTop: spacing.xs }}
                />
                <BackgroundColorSelector
                  value={String(draft?.landingBackgroundColorKey || '')}
                  onChange={(key) => setDraft((prev) => (prev ? { ...prev, landingBackgroundColorKey: key } : prev))}
                  palette={palette}
                  typography={typography}
                  spacing={spacing}
                  title="Landing Background Color (6 options)"
                />
                <View style={{ marginTop: spacing.xs }}>
                  <KISButton
                    title="Clear Landing Background Color"
                    variant="outline"
                    onPress={() => setDraft((prev) => (prev ? { ...prev, landingBackgroundColorKey: '' } : prev))}
                    disabled={saving || !draft?.landingBackgroundColorKey}
                  />
                </View>

                <View style={{ marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm }}>
                  <KISButton
                    title={uploadingLandingLogo ? 'Selecting Logo...' : 'Select Landing Logo'}
                    variant="outline"
                    onPress={handlePickLandingLogo}
                    disabled={saving || uploadingLandingLogo}
                  />
                  <KISButton
                    title="Remove Logo"
                    variant="outline"
                    onPress={() => setDraft((prev) => (prev ? { ...prev, landingLogoUrl: '' } : prev))}
                    disabled={saving || uploadingLandingLogo || !(draft as any)?.landingLogoUrl}
                  />
                </View>
                <KISTextInput
                  label="Landing Logo URL"
                  value={String((draft as any)?.landingLogoUrl || '')}
                  editable={false}
                  style={{ marginTop: spacing.xs }}
                />
              </View>
            ) : null}
            <SectionPreview
              sections={sections}
              palette={palette}
              typography={typography}
              spacing={spacing}
              editable
              onEdit={handleEditSection}
              onDelete={handleDeleteSection}
            />

            <View onLayout={(event) => setFormAreaY(event.nativeEvent.layout.y)}>
              <Text style={{ ...typography.h3, color: palette.text, marginTop: spacing.lg }}>+ Add New Section</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsSectionTypePickerOpen((prev) => !prev)}
              style={{
                marginTop: spacing.sm,
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: spacing.md,
                backgroundColor: palette.card,
                padding: spacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.caption, color: palette.subtext }}>
                  Select Section Type
                </Text>
                <Text style={{ ...typography.label, color: palette.text, marginTop: 2 }}>
                  {selectedSectionTypeLabel}
                </Text>
              </View>
              <KISIcon name="chevron-down" size={16} color={palette.subtext} />
            </TouchableOpacity>

            {isSectionTypePickerOpen ? (
              <SectionTypeSelector
                value={selectedType}
                onChange={handleSelectSectionType}
                palette={palette}
                typography={typography}
                spacing={spacing}
              />
            ) : null}

            {selectedType ? (
              <KISTextInput
                label="Section Name"
                value={sectionDraftName}
                onChangeText={setSectionDraftName}
                style={{ marginTop: spacing.sm }}
              />
            ) : null}

            <DynamicSectionForm
              selectedType={selectedType}
              draftData={sectionDraftData}
              onDataChange={setSectionDraftData}
              onPickSingleImage={handlePickSingleImage}
              onPickSectionBackgroundImage={handlePickSectionBackgroundImage}
              onRemoveSectionBackgroundImage={handleRemoveSectionBackgroundImage}
              onPickGalleryImage={handlePickGalleryImage}
              palette={palette}
              typography={typography}
              spacing={spacing}
            />

            {uploadingImage ? (
              <Text style={{ ...typography.caption, color: palette.subtext, marginTop: spacing.xs }}>Uploading selected image...</Text>
            ) : null}

            <View style={{ marginTop: spacing.sm }}>
              <KISButton
                title={editingSectionId ? 'Update Section' : 'Create Section'}
                onPress={handleAddSection}
                disabled={!selectedType || saving || uploadingImage}
              />
            </View>
            {editingSectionId ? (
              <View style={{ marginTop: spacing.xs }}>
                <KISButton
                  title="Cancel Editing"
                  variant="outline"
                  onPress={() => {
                    setEditingSectionId(null);
                    setSelectedType(null);
                    setSectionDraftName('');
                    setSectionDraftData({});
                  }}
                  disabled={saving || uploadingImage}
                />
              </View>
            ) : null}

            <View style={{ marginTop: spacing.md, flexDirection: 'column', gap: spacing.sm }}>
              <KISButton title="Open Fullscreen Preview" variant="outline" onPress={handleOpenLandingPreview} disabled={saving} />
              <KISButton title="Save Profile Page" onPress={handleSave} disabled={saving} />
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
