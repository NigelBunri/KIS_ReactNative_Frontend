import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import type { KISPalette } from '@/theme/constants';
import Video from 'react-native-video';
import { popularLanguages } from '../profile/profile.constants';
import type { ItemType } from '../profile/profile.types';
import { styles } from '../profile/profile.styles';
import SectionCardsList from '@/screens/tabs/profile-screen-sections/SectionCardsList';

type SectionDescriptor = {
  key: string;
  title: string;
  items: any[];
};

type ProfileGalleryItem = {
  id: string;
  uri: string;
  kind: 'image' | 'video';
  title?: string;
  section?: string;
  itemType?: ItemType;
  itemId?: string;
  deletable?: boolean;
};

type EditProfileModalProps = {
  palette: KISPalette;
  draftProfile: any;
  setDraftProfile: React.Dispatch<React.SetStateAction<any>>;
  pickImage: (type: 'avatar' | 'cover') => Promise<void>;
  saving: boolean;
  saveProfile: () => void;
  sections?: SectionDescriptor[];
  onAddSectionItem?: (type: ItemType) => void;
  onEditSectionItem?: (type: ItemType, item: any) => void;
  onDeleteSectionItem?: (type: ItemType, id: string) => void;
  galleryItems?: ProfileGalleryItem[];
  onAddGalleryMedia?: () => void | Promise<void>;
  addingGalleryMedia?: boolean;
  onDeleteGalleryItem?: (item: ProfileGalleryItem) => void | Promise<void>;
  deletingGalleryItemId?: string | null;
};

const DEFAULT_LANGUAGE = 'English';
const POPULAR_LANGUAGE_MAP = new Map(
  popularLanguages.map((label) => [String(label).trim().toLowerCase(), String(label).trim()]),
);

const extractLanguageLabel = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const labelMatch = trimmed.match(/label\s*[:=]\s*['"]?([^,'"\]}]+)['"]?/i);
    if (labelMatch?.[1]) return labelMatch[1].trim();
    return trimmed;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return extractLanguageLabel(
      record.label ?? record.name ?? record.language ?? record.language_name ?? record.value ?? '',
    );
  }
  return String(value).trim();
};

const normalizeModalLanguages = (raw: unknown) => {
  const source = Array.isArray(raw) ? raw : [raw];
  const out: string[] = [];
  const seen = new Set<string>();
  source.forEach((value) => {
    const label = extractLanguageLabel(value).trim();
    if (!label) return;
    const canonical = POPULAR_LANGUAGE_MAP.get(label.toLowerCase());
    if (!canonical) return;
    const key = canonical.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(canonical);
  });
  return out;
};

export function EditProfileModal(props: EditProfileModalProps) {
  const {
    palette,
    draftProfile,
    setDraftProfile,
    pickImage,
    saving,
    saveProfile,
    sections = [],
    onAddSectionItem,
    onEditSectionItem,
    onDeleteSectionItem,
    galleryItems = [],
    onAddGalleryMedia,
    addingGalleryMedia = false,
    onDeleteGalleryItem,
    deletingGalleryItemId = null,
  } = props;
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxTranslateY = useRef(new Animated.Value(0)).current;
  const touchStartX = useRef(0);
  const screenWidth = Dimensions.get('window').width;
  const galleryWidth = Math.max(screenWidth - 72, 260);
  const galleryScrollRef = useRef<ScrollView | null>(null);

  const gallery = useMemo(
    () =>
      galleryItems
        .map((item) => ({
          ...item,
          uri: String(item?.uri || '').trim(),
        }))
        .filter((item) => item.uri.length > 0),
    [galleryItems],
  );

  const selectedLanguages = useMemo(() => {
    const normalized = normalizeModalLanguages(draftProfile?.languages);
    return normalized.length ? normalized : [DEFAULT_LANGUAGE];
  }, [draftProfile?.languages]);

  useEffect(() => {
    setDraftProfile((prev: any) => {
      const normalized = normalizeModalLanguages(prev?.languages);
      if (normalized.length) return prev;
      return { ...prev, languages: [DEFAULT_LANGUAGE] };
    });
  }, [setDraftProfile]);

  useEffect(() => {
    if (!gallery.length) {
      setGalleryIndex(0);
      setLightboxIndex(0);
      return;
    }
    setGalleryIndex((prev) => Math.min(prev, gallery.length - 1));
    setLightboxIndex((prev) => Math.min(prev, gallery.length - 1));
  }, [gallery.length]);

  const openLightboxAt = (index: number) => {
    if (!gallery.length) return;
    setLightboxIndex(Math.max(0, Math.min(index, gallery.length - 1)));
    lightboxTranslateY.setValue(0);
    setLightboxVisible(true);
  };

  const closeLightbox = useCallback(() => {
    lightboxTranslateY.setValue(0);
    setLightboxVisible(false);
  }, [lightboxTranslateY]);

  const goToLightbox = useCallback((index: number) => {
    if (!gallery.length) return;
    const next = (index + gallery.length) % gallery.length;
    setLightboxIndex(next);
  }, [gallery.length]);

  const lightboxResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderGrant: () => {
          touchStartX.current = 0;
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            lightboxTranslateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 120) {
            closeLightbox();
            return;
          }

          Animated.spring(lightboxTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            speed: 20,
            bounciness: 6,
          }).start();
        },
      }),
    [closeLightbox, lightboxTranslateY],
  );

  const toggleLanguage = (label: string) => {
    setDraftProfile((prev: any) => {
      const current = normalizeModalLanguages(prev?.languages);
      const exists = current.includes(label);
      if (exists && current.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        languages: exists ? current.filter((value: string) => value !== label) : [...current, label],
      };
    });
  };

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: palette.divider,
          backgroundColor: palette.surfaceElevated,
          padding: 12,
          overflow: 'hidden',
        }}
      >
        <Text style={[styles.title, { color: palette.text, fontSize: 16 }]}>Live Profile Preview</Text>
        <Text style={[styles.subtext, { color: palette.subtext }]}>
          Your cover appears below your profile image, just like the public profile.
        </Text>
        <View style={{ marginTop: 12, height: 220, borderRadius: 16, marginBottom: 40}}>
          <View
            style={{
              height: '100%',
              borderRadius: 16,
              backgroundColor: palette.card,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: palette.divider,
            }}
          >
            {draftProfile?.cover_preview ? (
              <Image source={{ uri: draftProfile.cover_preview }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <KISIcon name="image" size={24} color={palette.subtext} />
                <Text style={[styles.subtext, { color: palette.subtext, marginTop: 6 }]}>Add a cover image</Text>
              </View>
            )}

             <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 24,
                borderWidth: 3,
                borderColor: palette.bg,
                backgroundColor: palette.card,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'absolute',
                left: 16,
                bottom: 16,
              }}
            >
              {draftProfile?.avatar_preview ? (
                <Image source={{ uri: draftProfile.avatar_preview }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <KISIcon name="user" size={20} color={palette.subtext} />
              )}
            </View>
            <View style={{ flex: 1, paddingBottom: 8, position: 'absolute', left: 100, right: 16, bottom: 16, justifyContent: 'center' }}>
              <Text style={[styles.title, { color: "white", fontSize: 17 }]}>
                {draftProfile?.display_name || 'Your name'}
              </Text>
              <Text style={[styles.subtext, { color: "white" }]} numberOfLines={2}>
                {draftProfile?.headline || 'Add a headline that tells people what you do.'}
              </Text>
            </View>
          </View>
          </View>
          <View
            style={{
              marginTop: -34,
              paddingHorizontal: 10,
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 12,
            }}
          >
           
        </View>
      </View>

      <View style={styles.editMediaRow}>
        <Pressable
          onPress={() => pickImage('avatar')}
          style={[styles.mediaPickCard, { backgroundColor: palette.surface }]}
        >
          {draftProfile?.avatar_preview ? (
            <Image source={{ uri: draftProfile.avatar_preview }} style={styles.mediaPickImage} />
          ) : (
            <View
              style={[
                styles.mediaPickImage,
                {
                  backgroundColor: palette.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <KISIcon name="user" size={18} color={palette.subtext} />
            </View>
          )}
          <Text style={[styles.mediaPickLabel, { color: palette.text }]}>Change avatar</Text>
        </Pressable>

        <Pressable
          onPress={() => pickImage('cover')}
          style={[styles.mediaPickCard, { backgroundColor: palette.surface, flex: 1 }]}
        >
          {draftProfile?.cover_preview ? (
            <Image source={{ uri: draftProfile.cover_preview }} style={styles.mediaPickImageWide} />
          ) : (
            <View
              style={[
                styles.mediaPickImageWide,
                {
                  backgroundColor: palette.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <KISIcon name="image" size={18} color={palette.subtext} />
            </View>
          )}
          <Text style={[styles.mediaPickLabel, { color: palette.text }]}>Change cover</Text>
        </Pressable>
      </View>

      <KISTextInput
        label="Display name"
        value={draftProfile?.display_name}
        onChangeText={(t) => setDraftProfile((s: any) => ({ ...s, display_name: t }))}
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <KISTextInput
            label="Country code (auto from location)"
            value={draftProfile?.country_code}
            editable={false}
          />
        </View>
        <View style={{ flex: 2 }}>
          <KISTextInput
            label="Phone number"
            value={draftProfile?.phone_number}
            onChangeText={(t) => setDraftProfile((s: any) => ({ ...s, phone_number: t }))}
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>
      <KISTextInput
        label="Headline"
        value={draftProfile?.headline}
        onChangeText={(t) => setDraftProfile((s: any) => ({ ...s, headline: t }))}
      />
      <KISTextInput
        label="Industry"
        value={draftProfile?.industry}
        onChangeText={(t) => setDraftProfile((s: any) => ({ ...s, industry: t }))}
      />
      <KISTextInput
        label="Bio"
        value={draftProfile?.bio}
        onChangeText={(t) => setDraftProfile((s: any) => ({ ...s, bio: t }))}
        multiline
        style={{ minHeight: 110, color: palette.text }}
      />

      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: palette.divider,
          padding: 12,
          backgroundColor: palette.surface,
          gap: 10,
        }}
      >
        <Text style={[styles.title, { color: palette.text, fontSize: 15 }]}>Languages</Text>
        <Text style={[styles.subtext, { color: palette.subtext }]}>
          Choose up to 6 popular languages for profile discoverability.
        </Text>
        <View style={styles.chipRow}>
          {popularLanguages.map((language) => {
            const selected = selectedLanguages.includes(language);
            return (
              <Pressable
                key={language}
                onPress={() => toggleLanguage(language)}
                style={[
                  styles.chip,
                  {
                    borderWidth: 1,
                    borderColor: selected ? palette.primary : palette.divider,
                    backgroundColor: selected ? `${palette.primary}22` : palette.card,
                  },
                ]}
              >
                <Text style={{ color: selected ? palette.primaryStrong : palette.text, fontSize: 12, fontWeight: '700' }}>
                  {language}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: palette.divider,
          padding: 12,
          backgroundColor: palette.surface,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Text style={[styles.title, { color: palette.text, fontSize: 15 }]}>Portfolio Slideshow</Text>
          <Pressable
            onPress={() => onAddGalleryMedia?.()}
            disabled={addingGalleryMedia}
            style={[
              styles.chip,
              {
                borderWidth: 1,
                borderColor: palette.primary,
                backgroundColor: `${palette.primary}18`,
                opacity: addingGalleryMedia ? 0.65 : 1,
              },
            ]}
          >
            <Text style={{ color: palette.primaryStrong, fontSize: 12, fontWeight: '700' }}>
              {addingGalleryMedia ? 'Adding...' : 'Add media'}
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.subtext, { color: palette.subtext }]}>
          Tap any slide for fullscreen. Tap left/right to move. Pull down to close.
        </Text>

        {gallery.length === 0 ? (
          <View
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: palette.divider,
              minHeight: 140,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: palette.card,
            }}
          >
            <KISIcon name="image" size={22} color={palette.subtext} />
            <Text style={[styles.subtext, { color: palette.subtext, marginTop: 8 }]}>
              Add portfolio/case study/intro video items below.
            </Text>
          </View>
        ) : (
          <>
            <View
              style={{
                width: galleryWidth,
                alignSelf: 'center',
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              <ScrollView
                ref={(node) => {
                  galleryScrollRef.current = node;
                }}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const index = Math.round(offsetX / galleryWidth);
                  setGalleryIndex(Math.max(0, Math.min(index, gallery.length - 1)));
                }}
              >
                {gallery.map((item, index) => (
                  <Pressable
                    key={item.id}
                    onPress={() => openLightboxAt(index)}
                    style={{
                      width: galleryWidth,
                      height: 210,
                      backgroundColor: palette.card,
                      borderWidth: 1,
                      borderColor: palette.divider,
                    }}
                  >
                    {item.kind === 'video' ? (
                      <>
                        <Video
                          source={{ uri: item.uri }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                          paused
                          controls={false}
                          repeat={false}
                        />
                        <View
                          style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            borderRadius: 999,
                            backgroundColor: '#00000077',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>VIDEO</Text>
                        </View>
                      </>
                    ) : (
                      <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} />
                    )}
                    {item.deletable && item.itemId ? (
                      <Pressable
                        onPress={() => onDeleteGalleryItem?.(item)}
                        disabled={deletingGalleryItemId === item.itemId}
                        style={{
                          position: 'absolute',
                          top: 10,
                          left: 10,
                          borderRadius: 999,
                          backgroundColor: '#00000088',
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                          {deletingGalleryItemId === item.itemId ? '...' : 'Delete'}
                        </Text>
                      </Pressable>
                    ) : null}
                    <View
                      style={{
                        position: 'absolute',
                        left: 10,
                        right: 10,
                        bottom: 10,
                        borderRadius: 10,
                        backgroundColor: '#00000088',
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '700' }} numberOfLines={1}>
                        {item.title || item.section || 'Gallery item'}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              {gallery.map((item, index) => (
                <Pressable
                  key={`${item.id}_dot`}
                  onPress={() => {
                    galleryScrollRef.current?.scrollTo({ x: galleryWidth * index, animated: true });
                    setGalleryIndex(index);
                  }}
                  style={{
                    width: index === galleryIndex ? 18 : 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: index === galleryIndex ? palette.primary : palette.divider,
                  }}
                />
              ))}
            </View>
          </>
        )}
      </View>

      <View style={{ gap: 10 }}>
        <Text style={[styles.title, { color: palette.text, fontSize: 16 }]}>Edit Profile Content</Text>
        <Text style={[styles.subtext, { color: palette.subtext }]}>
          Experience, education, projects, skills, portfolio, case studies, and more live here.
        </Text>
        {sections.length > 0 ? (
          <SectionCardsList
            sections={sections}
            onAdd={(type) => onAddSectionItem?.(type)}
            onEdit={(type, item) => onEditSectionItem?.(type, item)}
            onDelete={(type, id) => onDeleteSectionItem?.(type, id)}
          />
        ) : null}
      </View>

      <KISButton
        style={{ marginTop: 18, marginBottom: 10 }}
        title={saving ? 'Saving...' : 'Save Profile Changes'}
        onPress={saveProfile}
        disabled={saving}
      />

      <Modal visible={lightboxVisible} animationType="fade" transparent onRequestClose={closeLightbox}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' }} {...lightboxResponder.panHandlers}>
          <Animated.View style={{ flex: 1, transform: [{ translateY: lightboxTranslateY }] }}>
            {gallery[lightboxIndex]?.kind === 'video' ? (
              <Video
                source={{ uri: gallery[lightboxIndex]?.uri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
                controls
              />
            ) : (
              <Image
                source={{ uri: gallery[lightboxIndex]?.uri }}
                style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
              />
            )}
          </Animated.View>

          <View
            style={{
              position: 'absolute',
              top: 110,
              left: 0,
              right: 0,
              bottom: 92,
              flexDirection: 'row',
            }}
          >
            <Pressable
              onPress={() => goToLightbox(lightboxIndex - 1)}
              style={{ flex: 1 }}
              accessibilityRole="button"
              accessibilityLabel="Previous media"
            />
            <Pressable
              onPress={() => goToLightbox(lightboxIndex + 1)}
              style={{ flex: 1 }}
              accessibilityRole="button"
              accessibilityLabel="Next media"
            />
          </View>

          <View
            style={{
              position: 'absolute',
              top: 48,
              left: 14,
              right: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              {gallery[lightboxIndex]?.title || gallery[lightboxIndex]?.section || 'Gallery preview'}
            </Text>
            {gallery[lightboxIndex]?.deletable && gallery[lightboxIndex]?.itemId ? (
              <Pressable
                onPress={() => onDeleteGalleryItem?.(gallery[lightboxIndex])}
                disabled={deletingGalleryItemId === gallery[lightboxIndex]?.itemId}
                style={{
                  borderRadius: 999,
                  backgroundColor: '#FFFFFF22',
                  minWidth: 56,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                  paddingHorizontal: 10,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                  {deletingGalleryItemId === gallery[lightboxIndex]?.itemId ? '...' : 'Delete'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={closeLightbox}
              style={{
                borderRadius: 999,
                backgroundColor: '#FFFFFF22',
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <KISIcon name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          <View
            style={{
              position: 'absolute',
              bottom: 28,
              left: 0,
              right: 0,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFFCC', fontSize: 12 }}>
              {gallery.length > 0 ? `${lightboxIndex + 1} / ${gallery.length}` : ''}
            </Text>
            <Text style={{ color: '#FFFFFF99', fontSize: 11, marginTop: 4 }}>
              Pull down to close. Tap left/right to move.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}
