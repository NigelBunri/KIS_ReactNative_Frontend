import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import { KISIcon } from '@/constants/kisIcons';
import {
  getHealthThemeBorders,
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import DynamicSectionForm from '@/components/section-builder/DynamicSectionForm';
import SectionPreview from '@/components/section-builder/SectionPreview';
import SectionTypeSelector from '@/components/section-builder/SectionTypeSelector';
import BackgroundColorSelector from '@/components/section-builder/BackgroundColorSelector';
import { SECTION_TYPE_META } from '@/components/section-builder/sectionTypeMeta';
import {
  createEmptySectionData,
  createSection,
  type DynamicLandingSection,
  type SectionType,
} from '@/components/section-builder/types';
import { resolveBackgroundColor } from '@/components/section-builder/backgroundOptions';
import type { InstitutionProfileEditorDraft } from '@/features/health-dashboard/models';

type LandingTargetKind = 'market' | 'education' | 'partner';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileLandingEditor'>;

const baseDraft = (title: string): InstitutionProfileEditorDraft => ({
  hero: {
    imageUrl: '',
    title,
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
  landingLogoUrl: '',
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
  if (draft?.contact) {
    sections.push({
      id: `legacy_contact_${Date.now()}`,
      name: 'Contact',
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

const mergeLegacyCompatibility = (base: InstitutionProfileEditorDraft, sections: DynamicLandingSection[]) => {
  const hero = sections.find((section) => section.type === 'hero_banner');
  const about = sections.find((section) => section.type === 'about');
  const gallery = sections.find((section) => section.type === 'image_gallery_grid');
  const contact = sections.find((section) => section.type === 'contact_information');
  const heroData = (hero?.data || {}) as any;
  const aboutData = (about?.data || {}) as any;
  const galleryData = (gallery?.data || {}) as any;
  const contactData = (contact?.data || {}) as any;

  return {
    ...base,
    sections,
    hero: {
      ...base.hero,
      imageUrl: String(heroData?.backgroundImageUrl || base.hero.imageUrl || ''),
      title: String(heroData?.title || base.hero.title || ''),
      slogan: String(heroData?.subtitle || base.hero.slogan || ''),
      ctaLabel: String(heroData?.ctaText || base.hero.ctaLabel || 'Book Now'),
      ctaUrl: String(heroData?.ctaLink || base.hero.ctaUrl || ''),
    },
    about: String(aboutData?.description || base.about || ''),
    gallery: Array.isArray(galleryData?.images) ? galleryData.images : base.gallery,
    contact: {
      ...base.contact,
      phone: String(contactData?.phone || base.contact.phone || ''),
      email: String(contactData?.email || base.contact.email || ''),
      address: String(contactData?.address || base.contact.address || ''),
    },
  };
};

const extractDraft = (raw: any, fallbackTitle: string): InstitutionProfileEditorDraft => {
  const base = baseDraft(fallbackTitle);
  const existing =
    raw?.profile_editor ??
    raw?.profileEditor ??
    raw?.landing_page_builder ??
    raw?.landingPageBuilder ??
    raw?.landing_preview ??
    raw?.landingPreview ??
    raw?.draft ??
    raw ??
    {};

  return {
    ...base,
    ...(existing || {}),
    hero: {
      ...base.hero,
      ...(existing?.hero || {}),
      title: existing?.hero?.title || base.hero.title,
    },
    contact: {
      ...base.contact,
      ...(existing?.contact || {}),
    },
    landingBackgroundImageUrl: String(existing?.landingBackgroundImageUrl || ''),
    landingBackgroundColorKey: String(existing?.landingBackgroundColorKey || base.landingBackgroundColorKey || ''),
    landingLogoUrl: String(existing?.landingLogoUrl || ''),
  };
};

const uploadProfileImage = async (asset: any, context: string): Promise<string> => {
  if (!asset?.uri) return '';
  const form = new FormData();
  form.append('attachment', {
    uri: asset.uri,
    name: asset.fileName || `landing-${Date.now()}.jpg`,
    type: asset.type || 'image/jpeg',
  } as any);
  form.append('context', context);
  const res = await postRequest(ROUTES.broadcasts.profileAttachment, form);
  const file = (res as any)?.data?.attachment ?? (res as any)?.attachment ?? {};
  return String(file?.url || file?.uri || file?.file_url || file?.fileUrl || asset.uri);
};

const kindTitle = (kind: LandingTargetKind) => {
  if (kind === 'market') return 'Market Profile';
  if (kind === 'education') return 'Education Profile';
  return 'Partner Profile';
};

export default function ProfileLandingEditorScreen({ navigation, route }: Props) {
  const kind = (route.params?.kind || 'market') as LandingTargetKind;
  const partnerId = route.params?.partnerId;
  const shopId = route.params?.shopId;
  const profileLabel = route.params?.profileLabel || kindTitle(kind);
  const returnBroadcastProfileKey = route.params?.returnBroadcastProfileKey;
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const borders = getHealthThemeBorders(palette);
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const localBuilderCacheKey = useMemo(() => {
    if (kind === 'partner') return `kis_dynamic_section_builder_draft_v2:partner:${partnerId || 'self'}`;
    if (kind === 'market') return `kis_dynamic_section_builder_draft_v2:market:${shopId || 'current'}`;
    return `kis_dynamic_section_builder_draft_v2:${kind}`;
  }, [kind, partnerId, shopId]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingLandingImage, setUploadingLandingImage] = useState(false);
  const [uploadingLandingLogo, setUploadingLandingLogo] = useState(false);
  const [draft, setDraft] = useState<InstitutionProfileEditorDraft | null>(null);
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
    setLoading(true);
    try {
      let loaded: InstitutionProfileEditorDraft | null = null;

      if (kind === 'partner') {
        if (!partnerId) throw new Error('Partner id is required.');
        const configRes = await getRequest(ROUTES.partners.settingsConfigDetail(partnerId, 'landing_page_builder'));
        const config = (configRes as any)?.data?.config ?? (configRes as any)?.config ?? {};
        loaded = extractDraft(config, profileLabel);
      } else if (kind === 'market') {
        if (!shopId) throw new Error('Shop id is required.');
        const shopRes = await getRequest(`${ROUTES.commerce.shops}${shopId}/`);
        const shopData = (shopRes as any)?.data ?? shopRes ?? {};
        const landingPage = shopData?.landing_page ?? shopData?.landingPage ?? {};
        loaded = extractDraft(landingPage, profileLabel);
      } else {
        const res = await getRequest(ROUTES.broadcasts.createProfile);
        const profile = res?.data?.profiles?.[kind] ?? {};
        loaded = extractDraft(profile, profileLabel);
      }

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

      const nextSections = normalizeSections(loaded || baseDraft(profileLabel));
      setDraft(loaded || baseDraft(profileLabel));
      setSections(cachedSections && cachedSections.length > 0 ? cachedSections : nextSections);
    } catch (error: any) {
      Alert.alert('Landing page', error?.message || 'Unable to load landing page data.');
      const fallback = baseDraft(profileLabel);
      setDraft(fallback);
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [kind, localBuilderCacheKey, partnerId, profileLabel, shopId]);

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

  const selectedSectionTypeLabel = useMemo(() => {
    if (!selectedType) return 'Select section type';
    return SECTION_TYPE_META.find((item) => item.type === selectedType)?.title || 'Select section type';
  }, [selectedType]);

  const handlePickSingleImage = useCallback(async () => {
    if (!selectedType) return;
    setUploadingImage(true);
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      const url = await uploadProfileImage(asset, 'landing_section_image');
      if (selectedType === 'hero_banner') {
        setSectionDraftData((prev) => ({ ...prev, backgroundImageUrl: url }));
      } else if (selectedType === 'about') {
        setSectionDraftData((prev) => ({ ...prev, imageUrl: url }));
      }
    } catch (error: any) {
      Alert.alert('Landing page', error?.message || 'Unable to pick image.');
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
      const url = await uploadProfileImage(asset, 'landing_section_background');
      setSectionDraftData((prev) => ({ ...prev, sectionBackgroundImageUrl: url }));
    } catch (error: any) {
      Alert.alert('Landing page', error?.message || 'Unable to pick section background image.');
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
      const url = await uploadProfileImage(asset, 'landing_gallery_image');
      setSectionDraftData((prev) => ({
        ...prev,
        images: [...(Array.isArray(prev?.images) ? prev.images : []), url],
      }));
    } catch (error: any) {
      Alert.alert('Landing page', error?.message || 'Unable to pick image.');
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
      const url = await uploadProfileImage(asset, 'landing_background');
      setDraft((prev) => (prev ? { ...prev, landingBackgroundImageUrl: url } : prev));
    } catch (error: any) {
      Alert.alert('Landing page', error?.message || 'Unable to pick landing background image.');
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
      const url = await uploadProfileImage(asset, 'landing_logo');
      setDraft((prev) => (prev ? { ...prev, landingLogoUrl: url } : prev));
    } catch (error: any) {
      Alert.alert('Landing page', error?.message || 'Unable to pick landing page logo.');
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

  const handleOpenLandingPreview = useCallback(() => {
    navigation.navigate('InstitutionLandingPreview', {
      institutionName: draft?.hero?.title || profileLabel,
      draft: {
        ...(draft || {}),
        sections,
      },
    });
  }, [draft, navigation, profileLabel, sections]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const payload = mergeLegacyCompatibility(
        {
          ...draft,
          landingBackgroundImageUrl: draft.landingBackgroundImageUrl || '',
          landingBackgroundColorKey: draft.landingBackgroundColorKey || '',
          landingLogoUrl: (draft as any).landingLogoUrl || '',
        },
        sections,
      );

      if (kind === 'partner') {
        if (!partnerId) throw new Error('Partner id is required.');
        const res = await patchRequest(
          ROUTES.partners.settingsConfigDetail(partnerId, 'landing_page_builder'),
          { config: payload },
          { errorMessage: 'Unable to save partner landing page.' },
        );
        if (!res?.success) throw new Error(res?.message || 'Unable to save partner landing page.');
      } else if (kind === 'market') {
        if (!shopId) throw new Error('Shop id is required.');
        const res = await patchRequest(
          `${ROUTES.commerce.shops}${shopId}/`,
          { landing_page: payload },
          { errorMessage: 'Unable to save shop landing page.' },
        );
        if (!res?.success) throw new Error(res?.message || 'Unable to save shop landing page.');
        DeviceEventEmitter.emit('broadcast.refresh');
      } else {
        const profileType = 'education_profile';
        const res = await postRequest(ROUTES.broadcasts.profileManage, {
          profile_type: profileType,
          updates: {
            landing_page_builder: payload,
            profile_editor: payload,
            landing_preview: payload,
            sections: payload.sections,
            landingBackgroundImageUrl: payload.landingBackgroundImageUrl,
            landingBackgroundColorKey: payload.landingBackgroundColorKey,
            landingLogoUrl: payload.landingLogoUrl,
          },
        });
        if (!res?.success) throw new Error(res?.message || 'Unable to save landing page draft.');
      }

      setDraft(payload);
      setSections(normalizeSections(payload));
      if (localBuilderCacheKey) {
        await AsyncStorage.removeItem(localBuilderCacheKey);
      }
      Alert.alert('Landing page', 'Dynamic landing sections saved.');
    } catch (error: any) {
      Alert.alert('Landing page', error?.message || 'Unable to save landing page draft.');
    } finally {
      setSaving(false);
    }
  }, [draft, kind, localBuilderCacheKey, partnerId, sections, shopId]);

  if (loading || !draft) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={palette.accentPrimary} />
          <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.sm }}>Loading landing builder...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1 }}>
        <View style={{ alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <TouchableOpacity
            onPress={() => {
              if (returnBroadcastProfileKey) {
                DeviceEventEmitter.emit('profile.reopenManagementPanel', returnBroadcastProfileKey);
              }
              navigation.goBack();
            }}
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 12,
              padding: spacing.xs,
              backgroundColor: palette.card,
            }}
            accessibilityLabel="Close landing editor"
          >
            <KISIcon name="close" size={18} color={palette.text} />
          </TouchableOpacity>
        </View>

        <ScrollView ref={editorScrollRef} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
          <View style={{ borderRadius: spacing.lg, padding: spacing.md, backgroundColor: palette.card, ...borders.card }}>
            <Text style={{ ...typography.h2, color: palette.text }}>Landing Page Builder</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
              {profileLabel}
            </Text>

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
                <Text style={{ ...typography.caption, color: palette.subtext }}>Select Section Type</Text>
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
              <KISButton title="Save Landing Page" onPress={handleSave} disabled={saving} />
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
