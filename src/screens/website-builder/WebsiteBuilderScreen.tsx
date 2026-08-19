import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, Text, TouchableOpacity, View } from 'react-native';
import { NestedReorderableList, ScrollViewContainer, useReorderableDrag, reorderItems } from 'react-native-reorderable-list';
import { launchImageLibrary } from 'react-native-image-picker';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import { KISIcon } from '@/constants/kisIcons';
import {
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import DynamicSectionForm from '@/components/section-builder/DynamicSectionForm';
import SectionPreview, { LiveSectionPreview } from '@/components/section-builder/SectionPreview';
import SectionTypeSelector from '@/components/section-builder/SectionTypeSelector';
import { SECTION_TYPE_META } from '@/components/section-builder/sectionTypeMeta';
import {
  createEmptySectionData,
  createSection,
  type DynamicLandingSection,
  type SectionType,
} from '@/components/section-builder/types';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';

type Props = NativeStackScreenProps<RootStackParamList, 'WebsiteBuilder'>;

type WebsitePageSummary = {
  id: string;
  slug: string;
  title: string;
  is_home: boolean;
  status: 'draft' | 'published' | 'unpublished';
  sections: DynamicLandingSection[];
};

type WebsiteRecord = {
  id: string;
  slug: string;
  name: string;
  status: 'draft' | 'published' | 'unpublished';
  pages: WebsitePageSummary[];
  branding?: Record<string, any>;
};

const WEBSITE_PUBLIC_BASE_URL = 'https://kingdomimpactventures.org';

const uploadSectionImage = async (asset: any, context: string): Promise<string> => {
  if (!asset?.uri) return '';
  const form = new FormData();
  form.append('attachment', {
    uri: asset.uri,
    name: asset.fileName || `website-${Date.now()}.jpg`,
    type: asset.type || 'image/jpeg',
  } as any);
  form.append('context', context);
  const res = await postRequest(ROUTES.broadcasts.profileAttachment, form);
  const file = (res as any)?.data?.attachment ?? (res as any)?.attachment ?? {};
  return String(file?.url || file?.uri || file?.file_url || file?.fileUrl || asset.uri);
};

function PageTab({
  page, isActive, palette, typography, spacing, onPress, onLongPress,
}: {
  page: WebsitePageSummary;
  isActive: boolean;
  palette: any; typography: any; spacing: any;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const drag = useReorderableDrag();
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: palette.divider,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        backgroundColor: isActive ? palette.accentPrimary : palette.card,
      }}
    >
      <Pressable onLongPress={drag} hitSlop={8}>
        <KISIcon name="menu" size={14} color={isActive ? '#FFFFFF' : palette.subtext} />
      </Pressable>
      <Text style={{ ...typography.label, color: isActive ? '#FFFFFF' : palette.text }}>
        {page.title}{page.status === 'published' ? '' : ' (draft)'}
      </Text>
    </TouchableOpacity>
  );
}

export default function WebsiteBuilderScreen({ navigation, route }: Props) {
  const { ownerType, ownerId, ownerLabel } = route.params;
  const palette = getHealthThemeColors('light');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [website, setWebsite] = useState<WebsiteRecord | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [sections, setSections] = useState<DynamicLandingSection[]>([]);

  const [selectedType, setSelectedType] = useState<SectionType | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionDraftData, setSectionDraftData] = useState<Record<string, any>>({});
  const [sectionDraftName, setSectionDraftName] = useState('');
  const [isSectionTypePickerOpen, setIsSectionTypePickerOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isAddingPage, setIsAddingPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');

  const activePage = useMemo(() => website?.pages.find((p) => p.id === activePageId) || null, [website, activePageId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.websites.mine, { params: { owner_type: ownerType, owner_id: ownerId } });
      const data = (res as any)?.data ?? res;
      if (!data?.id) throw new Error((res as any)?.message || 'Unable to load website.');
      setWebsite(data);
      const home = (data.pages || []).find((p: WebsitePageSummary) => p.is_home) || data.pages?.[0];
      setActivePageId(home?.id || null);
      setSections(Array.isArray(home?.sections) ? home.sections : []);
    } catch (error: any) {
      Alert.alert('Website Builder', error?.message || 'Unable to load your website.');
    } finally {
      setLoading(false);
    }
  }, [ownerType, ownerId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const switchPage = useCallback((page: WebsitePageSummary) => {
    setActivePageId(page.id);
    setSections(Array.isArray(page.sections) ? page.sections : []);
    setSelectedType(null);
    setEditingSectionId(null);
  }, []);

  useEffect(() => {
    if (!selectedType) {
      setSectionDraftData({});
      setSectionDraftName('');
      return;
    }
    setSectionDraftData(createEmptySectionData(selectedType));
    setSectionDraftName(SECTION_TYPE_META.find((item) => item.type === selectedType)?.title || '');
  }, [selectedType]);

  const handlePickSingleImage = useCallback(async () => {
    if (!selectedType) return;
    setUploadingImage(true);
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      const url = await uploadSectionImage(asset, 'website_section_image');
      if (selectedType === 'hero_banner') setSectionDraftData((prev) => ({ ...prev, backgroundImageUrl: url }));
      else if (selectedType === 'about') setSectionDraftData((prev) => ({ ...prev, imageUrl: url }));
    } catch (error: any) {
      Alert.alert('Website Builder', error?.message || 'Unable to pick image.');
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
      const url = await uploadSectionImage(asset, 'website_section_background');
      setSectionDraftData((prev) => ({ ...prev, sectionBackgroundImageUrl: url }));
    } catch (error: any) {
      Alert.alert('Website Builder', error?.message || 'Unable to pick background image.');
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
      const url = await uploadSectionImage(asset, 'website_gallery_image');
      setSectionDraftData((prev) => ({ ...prev, images: [...(Array.isArray(prev?.images) ? prev.images : []), url] }));
    } catch (error: any) {
      Alert.alert('Website Builder', error?.message || 'Unable to pick image.');
    } finally {
      setUploadingImage(false);
    }
  }, [selectedType]);

  const handleAddSection = useCallback(() => {
    if (!selectedType) {
      Alert.alert('Sections', 'Select a section type first.');
      return;
    }
    if (editingSectionId) {
      setSections((prev) =>
        prev.map((section) =>
          section.id !== editingSectionId
            ? section
            : { ...section, type: selectedType, name: sectionDraftName || section.name, data: { ...createEmptySectionData(selectedType), ...sectionDraftData } as any },
        ),
      );
    } else {
      const created = createSection(selectedType);
      created.name = sectionDraftName || created.name;
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
  }, [sections]);

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
          }
        },
      },
    ]);
  }, [editingSectionId]);

  const handleReorderSections = useCallback((fromIndex: number, toIndex: number) => {
    setSections((prev) => reorderItems(prev, fromIndex, toIndex));
  }, []);

  const handleSavePage = useCallback(async () => {
    if (!website || !activePage) return;
    setSaving(true);
    try {
      const res = await patchRequest(
        ROUTES.websites.pageDetail(website.id, activePage.id),
        { sections },
        { errorMessage: 'Unable to save this page.' },
      );
      if (!res?.success) throw new Error((res as any)?.message || 'Unable to save this page.');
      setWebsite((prev) => prev ? { ...prev, pages: prev.pages.map((p) => (p.id === activePage.id ? { ...p, sections } : p)) } : prev);
      Alert.alert('Website Builder', 'Page saved.');
    } catch (error: any) {
      Alert.alert('Website Builder', error?.message || 'Unable to save this page.');
    } finally {
      setSaving(false);
    }
  }, [website, activePage, sections]);

  const handleConfirmAddPage = useCallback(async () => {
    if (!website) return;
    const trimmed = newPageTitle.trim();
    if (!trimmed) return;
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    try {
      const res = await postRequest(ROUTES.websites.pages(website.id), { title: trimmed, slug }, { errorMessage: 'Unable to add page.' });
      if (!res?.success) throw new Error((res as any)?.message || 'Unable to add page.');
      setNewPageTitle('');
      setIsAddingPage(false);
      await load();
    } catch (error: any) {
      Alert.alert('Website Builder', error?.message || 'Unable to add page.');
    }
  }, [website, newPageTitle, load]);

  const handleDeletePage = useCallback((page: WebsitePageSummary) => {
    if (!website || page.is_home) return;
    Alert.alert('Delete page', `Delete "${page.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteRequest(ROUTES.websites.pageDetail(website.id, page.id), { errorMessage: 'Unable to delete page.' });
          if (!res?.success) {
            Alert.alert('Website Builder', (res as any)?.message || 'Unable to delete page.');
            return;
          }
          await load();
        },
      },
    ]);
  }, [website, load]);

  const handleReorderPages = useCallback(async (fromIndex: number, toIndex: number) => {
    if (!website) return;
    const reordered = reorderItems(website.pages, fromIndex, toIndex);
    setWebsite((prev) => (prev ? { ...prev, pages: reordered } : prev));
    try {
      await Promise.all(
        reordered.map((page, index) =>
          patchRequest(ROUTES.websites.pageDetail(website.id, page.id), { sort_order: index }, { errorMessage: 'Unable to save page order.' }),
        ),
      );
    } catch (error: any) {
      Alert.alert('Website Builder', error?.message || 'Unable to save page order.');
      await load();
    }
  }, [website, load]);

  const handlePublishWebsite = useCallback(async () => {
    if (!website) return;
    const res = await postRequest(ROUTES.websites.publish(website.id), {}, { errorMessage: 'Unable to publish website.' });
    if (!res?.success) {
      Alert.alert('Website Builder', (res as any)?.message || 'Upgrade your plan to publish your website.');
      return;
    }
    await load();
  }, [website, load]);

  const handleUnpublishWebsite = useCallback(async () => {
    if (!website) return;
    await postRequest(ROUTES.websites.unpublish(website.id), {}, { errorMessage: 'Unable to unpublish website.' });
    await load();
  }, [website, load]);

  const handlePublishPage = useCallback(async () => {
    if (!website || !activePage) return;
    const res = await postRequest(ROUTES.websites.pagePublish(website.id, activePage.id), {}, { errorMessage: 'Unable to publish page.' });
    if (!res?.success) {
      Alert.alert('Website Builder', (res as any)?.message || 'Unable to publish page.');
      return;
    }
    await load();
  }, [website, activePage, load]);

  const handlePreview = useCallback(async () => {
    if (!website) return;
    const res = await postRequest(ROUTES.websites.previewToken(website.id), {}, { errorMessage: 'Unable to open preview.' });
    const previewUrl = (res as any)?.data?.preview_url ?? (res as any)?.preview_url;
    navigation.navigate('WebsitePreview', { websiteId: website.id, previewUrl });
  }, [website, navigation]);

  const handleOpenTheme = useCallback(() => {
    if (!website) return;
    navigation.navigate('WebsiteTheme', { websiteId: website.id, branding: website.branding });
  }, [website, navigation]);

  const handleOpenFormResponses = useCallback(() => {
    if (!website) return;
    navigation.navigate('WebsiteFormResponses', { websiteId: website.id });
  }, [website, navigation]);

  const handleOpenWebhooks = useCallback(() => {
    if (!website) return;
    navigation.navigate('WebsiteWebhooks', { websiteId: website.id });
  }, [website, navigation]);

  const handleOpenCollaborators = useCallback(() => {
    if (!website) return;
    navigation.navigate('WebsiteCollaborators', { websiteId: website.id });
  }, [website, navigation]);

  const handleOpenVisits = useCallback(() => {
    if (!website) return;
    navigation.navigate('WebsiteVisits', { websiteId: website.id });
  }, [website, navigation]);

  const handleOpenCustomDomain = useCallback(() => {
    if (!website) return;
    navigation.navigate('WebsiteCustomDomain', { websiteId: website.id });
  }, [website, navigation]);

  const handleShare = useCallback(async () => {
    if (!website) return;
    const url = activePage && !activePage.is_home
      ? `${WEBSITE_PUBLIC_BASE_URL}/page/${website.slug}/${activePage.slug}`
      : `${WEBSITE_PUBLIC_BASE_URL}/page/${website.slug}`;
    try {
      await Share.share({ message: `${website.name} — ${url}`, url });
    } catch {
      // user dismissed share sheet
    }
  }, [website, activePage]);

  const selectedSectionTypeLabel = useMemo(() => {
    if (!selectedType) return 'Select section type';
    return SECTION_TYPE_META.find((item) => item.type === selectedType)?.title || 'Select section type';
  }, [selectedType]);

  if (loading || !website) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.accentPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollViewContainer contentContainerStyle={{ padding: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ ...typography.h2, color: palette.text }}>{ownerLabel || website.name}</Text>
            <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 2 }}>
              {website.status === 'published' ? 'Published' : website.status === 'unpublished' ? 'Unpublished' : 'Draft — not yet published'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          <KISButton title="Preview" variant="outline" onPress={handlePreview} />
          <KISButton title="Theme" variant="outline" onPress={handleOpenTheme} />
          <KISButton title="Responses" variant="outline" onPress={handleOpenFormResponses} />
          <KISButton title="Webhooks" variant="outline" onPress={handleOpenWebhooks} />
          <KISButton title="Collaborators" variant="outline" onPress={handleOpenCollaborators} />
          <KISButton title="Visits" variant="outline" onPress={handleOpenVisits} />
          <KISButton title="Custom Domain" variant="outline" onPress={handleOpenCustomDomain} />
          {website.status === 'published' ? (
            <>
              <KISButton title="Share" variant="outline" onPress={handleShare} />
              <KISButton title="Unpublish Website" variant="outline" onPress={handleUnpublishWebsite} />
            </>
          ) : (
            <KISButton title="Publish Website" onPress={handlePublishWebsite} />
          )}
        </View>

        <Text style={{ ...typography.h3, color: palette.text, marginTop: spacing.lg }}>Pages</Text>
        <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 2 }}>
          Hold the {'≡'} handle to reorder. Long-press a page (not Home) to delete it.
        </Text>
        <NestedReorderableList
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollable
          data={website.pages}
          keyExtractor={(page) => page.id}
          onReorder={({ from, to }) => handleReorderPages(from, to)}
          style={{ marginTop: spacing.xs }}
          contentContainerStyle={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}
          renderItem={({ item: page }) => (
            <PageTab
              page={page}
              isActive={page.id === activePageId}
              palette={palette}
              typography={typography}
              spacing={spacing}
              onPress={() => switchPage(page)}
              onLongPress={() => handleDeletePage(page)}
            />
          )}
          ListFooterComponent={
            <TouchableOpacity
              onPress={() => setIsAddingPage((prev) => !prev)}
              style={{ borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.divider, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}
            >
              <Text style={{ ...typography.label, color: palette.accentPrimary }}>+ Add Page</Text>
            </TouchableOpacity>
          }
        />

        {isAddingPage ? (
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <KISTextInput
                placeholder="Page title (e.g. About, Services, Contact)"
                value={newPageTitle}
                onChangeText={setNewPageTitle}
                onSubmitEditing={handleConfirmAddPage}
              />
            </View>
            <KISButton title="Add" size="sm" onPress={handleConfirmAddPage} disabled={!newPageTitle.trim()} />
          </View>
        ) : null}

        {activePage ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <KISButton title="Save Page" onPress={handleSavePage} disabled={saving} />
            {activePage.status !== 'published' ? (
              <KISButton title="Publish Page" variant="outline" onPress={handlePublishPage} />
            ) : null}
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
          reorderable
          onReorder={handleReorderSections}
        />

        <Text style={{ ...typography.h3, color: palette.text, marginTop: spacing.lg }}>+ Add Section</Text>
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
          <Text style={{ ...typography.label, color: palette.text }}>{selectedSectionTypeLabel}</Text>
          <KISIcon name="chevron-down" size={16} color={palette.subtext} />
        </TouchableOpacity>

        {isSectionTypePickerOpen ? (
          <SectionTypeSelector value={selectedType} onChange={(t) => { setSelectedType(t); setIsSectionTypePickerOpen(false); }} palette={palette} typography={typography} spacing={spacing} />
        ) : null}

        {selectedType ? (
          <KISTextInput label="Section Name" value={sectionDraftName} onChangeText={setSectionDraftName} style={{ marginTop: spacing.sm }} />
        ) : null}

        <LiveSectionPreview
          type={selectedType}
          data={sectionDraftData}
          palette={palette}
          typography={typography}
          spacing={spacing}
        />

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
          kisContentOwnerType={ownerType}
          kisContentOwnerId={ownerId}
        />

        {uploadingImage ? (
          <Text style={{ ...typography.caption, color: palette.subtext, marginTop: spacing.xs }}>Uploading selected image…</Text>
        ) : null}

        <View style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
          <KISButton title={editingSectionId ? 'Update Section' : 'Create Section'} onPress={handleAddSection} disabled={!selectedType || saving || uploadingImage} />
        </View>
      </ScrollViewContainer>
    </SafeAreaView>
  );
}
