import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  Pressable,
  Image,
  Linking,
  StyleSheet,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import type { Asset } from 'react-native-image-picker';
import type { KISPalette } from '@/theme/constants';
import { styles } from '../profile/profile.styles';
import { FEED_MEDIA_TYPES } from './types';
import type { FeedMediaType, FeedMediaOptions } from './types';
import { KISIcon } from '@/constants/kisIcons';
import BroadcastFeedVideoPreview from '@/components/broadcast/BroadcastFeedVideoPreview';
import { getAttachmentPreviewInfo } from '@/components/broadcast/attachmentPreview';

const RemoveAttachment = ({
  palette,
  feed,
  attachment,
  onRemoveAttachment,
}: {
  onRemoveAttachment: (feed: any, attachment: any) => void;
  feed: any;
  attachment: any;
  palette: any;
}) => {
  return (
    <View
      style={[
        modalStyles.deleteAttachment,
        { zIndex: 1, position: 'absolute', left: 6, top: 0 },
      ]}
    >
      <KISButton
        onPress={() => onRemoveAttachment(feed, attachment)}
        style={{ backgroundColor: '#ff8b33a4' }}
      >
        <KISIcon name="trash" size={20} color={palette.text} />
      </KISButton>
    </View>
  );
};

const AttachmentPreview: React.FC<{
  onRemoveAttachment: (feed: any, attachment: any) => void;
  feed: any;
  attachment: any;
  palette: KISPalette;
}> = ({ onRemoveAttachment, feed, attachment, palette }) => {
  const preview = getAttachmentPreviewInfo(attachment);
  const url = preview.url ?? preview.previewUri;
  if (!url) return null;
  const type = String(
    attachment?.media_type ?? attachment?.mime_type ?? attachment?.type ?? '',
  ).toLowerCase();

  if (preview.isVideo && url.startsWith('http')) {
    return (
      <>
        <RemoveAttachment
          onRemoveAttachment={onRemoveAttachment}
          feed={feed}
          attachment={attachment}
          palette={palette}
        />
        <BroadcastFeedVideoPreview
          attachment={attachment}
          palette={palette}
          videoStyle={{ borderRadius: 18, backgroundColor: palette.bar }}
          containerStyle={{ width: '100%', height: 200, borderRadius: 18 }}
        />
      </>
    );
  }

  if (preview.isImage || /\.(jpeg|jpg|gif|png|webp)$/i.test(url)) {
    return (
      <>
        <RemoveAttachment
          onRemoveAttachment={onRemoveAttachment}
          feed={feed}
          attachment={attachment}
          palette={palette}
        />
        <Image
          source={{ uri: url }}
          style={{
            width: '100%',
            height: 200,
            borderRadius: 18,
            backgroundColor: palette.bar,
          }}
          resizeMode="cover"
        />
      </>
    );
  }

  if (type.includes('pdf') || url.toLowerCase().endsWith('.pdf')) {
    return (
      <>
        <RemoveAttachment
          onRemoveAttachment={onRemoveAttachment}
          feed={feed}
          attachment={attachment}
          palette={palette}
        />
        <View
          style={{
            borderRadius: 18,
            borderWidth: 2,
            borderColor: palette.divider,
            padding: 14,
            alignItems: 'center',
          }}
        >
          <Text
            style={{ color: palette.text, fontWeight: '700', marginBottom: 6 }}
          >
            PDF attachment
          </Text>
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            {attachment?.name ?? url}
          </Text>
          <KISButton
            title="Open PDF"
            size="xs"
            onPress={() => Linking.openURL(url)}
          />
        </View>
      </>
    );
  }

  return (
    <>
      <RemoveAttachment
        onRemoveAttachment={onRemoveAttachment}
        feed={feed}
        attachment={attachment}
        palette={palette}
      />
      <View
        style={{
          borderRadius: 18,
          borderWidth: 2,
          borderColor: palette.divider,
          padding: 14,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: palette.text, fontSize: 12 }}>
          {attachment?.name ?? url}
        </Text>
        <Text style={{ color: palette.subtext, fontSize: 10 }}>
          {type || 'attachment'}
        </Text>
        <KISButton
          title="Open"
          size="xs"
          onPress={() => Linking.openURL(url)}
        />
      </View>
    </>
  );
};

type AttachmentCarouselProps = {
  attachments: any[];
  feed: any;
  palette: KISPalette;
  onRemoveAttachment: (feed: any, attachment: any) => void;
};

const AttachmentCarousel: React.FC<AttachmentCarouselProps> = ({
  attachments,
  feed,
  palette,
  onRemoveAttachment,
}) => {
  const { width } = useWindowDimensions();
  const slideWidth = Math.min(width - 64, 320);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.x;
      const index = Math.round(offset / (slideWidth + 12));
      setActiveIndex(index);
    },
    [slideWidth],
  );

  return (
    <View style={modalStyles.carouselWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={slideWidth + 12}
        snapToAlignment="start"
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        contentContainerStyle={modalStyles.carouselContent}
      >
        {attachments.map((attachment, idx) => {
          const baseKey =
            attachment?.id ?? attachment?.url ?? `attachment-${idx}`;
          return (
            <View
              key={`${feed.id}-${baseKey}-${idx}`}
              style={[modalStyles.carouselCard, { width: slideWidth }]}
            >
              <AttachmentPreview
                onRemoveAttachment={onRemoveAttachment}
                feed={feed}
                attachment={attachment}
                palette={palette}
              />
            </View>
          );
        })}
      </ScrollView>
      <View style={modalStyles.carouselDots}>
        {attachments.map((_, idx) => (
          <View
            key={`${feed.id}-dot-${idx}`}
            style={[
              modalStyles.carouselDot,
              idx === activeIndex && { backgroundColor: palette.primaryStrong },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

export type FeedManagementModalProps = {
  palette: KISPalette;
  title: string;
  subtitle: string;
  feeds: any[];
  expiresAt: string;
  panelFeedItemTitle: string;
  panelFeedItemSummary: string;
  panelFeedMediaType: FeedMediaType;
  panelFeedAssets: Asset[];
  panelFeedExistingAttachments: any[];
  panelFeedAdding: boolean;
  editingFeedItemId: string | null;
  panelFeedDeletingId: string | null;
  panelFeedBroadcastingId: string | null;
  handlePickFeedMedia: () => Promise<void>;
  removeTemporaryFeedAsset: (index: number) => void;
  handleSubmitFeedItem: () => void | Promise<void>;
  handleCancelFeedEdit: () => void;
  handleEditFeedItem: (item: any) => void;
  handleDeleteFeedItem: (id: string) => void;
  handleBroadcastFeedItem: (feed: any) => void;
  handleRemoveBroadcastFeedItem: (feed: any) => void;
  onOpenAdvancedComposer: () => void;
  setPanelFeedExistingAttachments: React.Dispatch<React.SetStateAction<any[]>>;
  setPanelFeedMediaType: React.Dispatch<React.SetStateAction<FeedMediaType>>;
  setPanelFeedItemTitle: React.Dispatch<React.SetStateAction<string>>;
  setPanelFeedItemSummary: React.Dispatch<React.SetStateAction<string>>;
  panelFeedMediaOptions: FeedMediaOptions;
  onUpdateMediaOptions: (
    type: FeedMediaType,
    updates: Partial<FeedMediaOptions[FeedMediaType]>,
  ) => void;
  textPreviewContent?: string;
  onRemoveAttachment: (feed: any, attachment: any) => Promise<void>;
};

export function FeedManagementModal(props: FeedManagementModalProps) {
  const {
    palette,
    title,
    subtitle,
    feeds,
    expiresAt,
    panelFeedItemTitle,
    panelFeedItemSummary,
    panelFeedMediaType,
    panelFeedAssets,
    panelFeedExistingAttachments,
    panelFeedAdding,
    editingFeedItemId,
    panelFeedDeletingId,
    panelFeedBroadcastingId,
    handlePickFeedMedia,
    removeTemporaryFeedAsset,
    handleSubmitFeedItem,
    handleCancelFeedEdit,
    handleEditFeedItem,
    handleDeleteFeedItem,
    handleBroadcastFeedItem,
    handleRemoveBroadcastFeedItem,
    onOpenAdvancedComposer,
    setPanelFeedExistingAttachments,
    setPanelFeedMediaType,
    setPanelFeedItemTitle,
    setPanelFeedItemSummary,
    panelFeedMediaOptions,
    onUpdateMediaOptions,
    onRemoveAttachment,
  } = props;

  const numberOfBroadcastFeeds = feeds.filter(
    (feed: any) => feed.is_broadcast === true,
  ).length;
  const attachmentCandidates = useMemo(() => {
    const attachments = [...panelFeedExistingAttachments, ...panelFeedAssets];
    return attachments
      .map((attachment, index) => {
        const preview = getAttachmentPreviewInfo(attachment);
        const key =
          attachment?.key ??
          attachment?.file_key ??
          attachment?.id ??
          attachment?.name ??
          preview.url ??
          preview.previewUri ??
          attachment?.uri ??
          `attachment-${index}`;
        if (!key) {
          return null;
        }
        const label =
          attachment?.name ??
          preview.url?.split?.('/')?.pop() ??
          preview.previewUri?.split?.('/')?.pop() ??
          `Attachment ${index + 1}`;
        return { key, label };
      })
      .filter((item): item is { key: string; label: string } => Boolean(item));
  }, [panelFeedAssets, panelFeedExistingAttachments]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.managementPanelBody,
        modalStyles.panelContent,
      ]}
    >
      <View
        style={[
          modalStyles.heroCard,
          {
            borderColor: palette.divider,
            backgroundColor: palette.card,
          },
        ]}
      >
        <Text style={[modalStyles.heroTitle, { color: palette.text }]}>
          {title}
        </Text>
        <Text style={[modalStyles.heroSubtitle, { color: palette.subtext }]}>
          {subtitle}
        </Text>
        <View style={modalStyles.heroStatsGrid}>
          <View
            style={[
              modalStyles.heroStatTile,
              {
                borderColor: palette.divider,
                backgroundColor: palette.surface,
              },
            ]}
          >
            <Text style={[modalStyles.heroStatValue, { color: palette.text }]}>
              {feeds.length}
            </Text>
            <Text
              style={[modalStyles.heroStatLabel, { color: palette.subtext }]}
            >
              Queued
            </Text>
          </View>
          <View
            style={[
              modalStyles.heroStatTile,
              {
                borderColor: palette.divider,
                backgroundColor: palette.surface,
              },
            ]}
          >
            <Text style={[modalStyles.heroStatValue, { color: palette.text }]}>
              {numberOfBroadcastFeeds}
            </Text>
            <Text
              style={[modalStyles.heroStatLabel, { color: palette.subtext }]}
            >
              Live
            </Text>
          </View>
          <View
            style={[
              modalStyles.heroStatTile,
              {
                borderColor: palette.divider,
                backgroundColor: palette.surface,
              },
            ]}
          >
            <Text style={[modalStyles.heroStatValue, { color: palette.text }]}>
              {expiresAt}
            </Text>
            <Text
              style={[modalStyles.heroStatLabel, { color: palette.subtext }]}
            >
              Cycle
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          modalStyles.sectionCard,
          {
            borderColor: palette.divider,
            backgroundColor: palette.card,
          },
        ]}
      >
        <View style={modalStyles.sectionHeader}>
          <Text style={[modalStyles.sectionTitle, { color: palette.text }]}>
            Feed Queue
          </Text>
          <Text
            style={[modalStyles.sectionSubtitle, { color: palette.subtext }]}
          >
            Edit, broadcast, or remove queued items.
          </Text>
        </View>
        {feeds.length === 0 ? (
          <View
            style={[
              modalStyles.emptyStateCard,
              {
                borderColor: palette.divider,
                backgroundColor: palette.surface,
              },
            ]}
          >
            <Text
              style={[modalStyles.emptyStateTitle, { color: palette.text }]}
            >
              No broadcast items yet
            </Text>
            <Text
              style={[modalStyles.emptyStateText, { color: palette.subtext }]}
            >
              Use the composer below to create your first feed item.
            </Text>
          </View>
        ) : (
          <View style={modalStyles.queueList}>
            {feeds.map(feed => {
              const isLive = !!feed.is_broadcast;
              const createdLabel = feed.created_at
                ? new Date(feed.created_at).toLocaleDateString()
                : 'Just now';
              const mediaLabel = feed.media_type
                ? String(feed.media_type).toUpperCase()
                : 'TEXT';
              const feedSummary =
                (feed.summary && feed.summary.length > 120
                  ? `${feed.summary.slice(0, 120)}…`
                  : feed.summary) || 'No summary';
              const attachments = [
                ...(Array.isArray(feed.attachments) ? feed.attachments : []),
              ].filter(Boolean);

              return (
                <View
                  key={feed.id}
                  style={[
                    modalStyles.feedCard,
                    {
                      borderColor: palette.divider,
                      backgroundColor: palette.surface,
                    },
                  ]}
                >
                  <View style={modalStyles.feedCardHeader}>
                    <Text
                      style={[modalStyles.feedTitle, { color: palette.text }]}
                    >
                      {feed.title}
                    </Text>
                    <View
                      style={[
                        modalStyles.feedStatusPill,
                        {
                          backgroundColor: isLive
                            ? palette.primarySoft
                            : palette.bar,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          modalStyles.feedStatusPillText,
                          {
                            color: isLive
                              ? palette.primaryStrong
                              : palette.subtext,
                          },
                        ]}
                      >
                        {isLive ? 'LIVE' : 'QUEUED'}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      modalStyles.feedSummary,
                      { color: palette.subtext },
                    ]}
                  >
                    {feedSummary}
                  </Text>

                  {attachments.length > 0 ? (
                    <AttachmentCarousel
                      attachments={attachments}
                      feed={feed}
                      palette={palette}
                      onRemoveAttachment={onRemoveAttachment}
                    />
                  ) : null}

                  <View style={modalStyles.feedMetaRow}>
                    <Text
                      style={[
                        modalStyles.feedMetaText,
                        { color: palette.subtext },
                      ]}
                    >
                      {mediaLabel}
                    </Text>
                    <Text
                      style={[
                        modalStyles.feedMetaDivider,
                        { color: palette.subtext },
                      ]}
                    >
                      •
                    </Text>
                    <Text
                      style={[
                        modalStyles.feedMetaText,
                        { color: palette.subtext },
                      ]}
                    >
                      {createdLabel}
                    </Text>
                  </View>

                  <View style={modalStyles.feedActionsRow}>
                    <KISButton
                      title="Edit"
                      size="xs"
                      variant="outline"
                      onPress={() => handleEditFeedItem(feed)}
                    />
                    {!isLive ? (
                      <KISButton
                        title={
                          panelFeedBroadcastingId === feed.id
                            ? 'Broadcasting…'
                            : 'Broadcast'
                        }
                        size="xs"
                        variant="outline"
                        onPress={() => handleBroadcastFeedItem(feed)}
                        disabled={panelFeedBroadcastingId === feed.id}
                      />
                    ) : (
                      <KISButton
                        title={
                          panelFeedBroadcastingId === feed.id
                            ? 'Removing…'
                            : 'Remove live'
                        }
                        size="xs"
                        variant="outline"
                        onPress={() => handleRemoveBroadcastFeedItem(feed)}
                        disabled={panelFeedBroadcastingId === feed.id}
                      />
                    )}
                    <KISButton
                      title={
                        panelFeedDeletingId === feed.id ? 'Deleting…' : 'Delete'
                      }
                      size="xs"
                      variant="secondary"
                      onPress={() => handleDeleteFeedItem(feed.id)}
                      disabled={panelFeedDeletingId === feed.id}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View
        style={[
          modalStyles.sectionCard,
          {
            borderColor: palette.divider,
            backgroundColor: palette.card,
          },
        ]}
      >
        <View style={modalStyles.sectionHeader}>
          <Text style={[modalStyles.sectionTitle, { color: palette.text }]}>
            {editingFeedItemId
              ? 'Update Broadcast Item'
              : 'Compose Broadcast Item'}
          </Text>
          <Text
            style={[modalStyles.sectionSubtitle, { color: palette.subtext }]}
          >
            Attach media, style by content type, and save to queue.
          </Text>
        </View>
        {!editingFeedItemId ? (
          <KISButton
            title="Open advanced composer"
            variant="outline"
            size="sm"
            onPress={onOpenAdvancedComposer}
          />
        ) : null}

        <View
          style={[
            modalStyles.attachmentHeader,
            {
              borderColor: palette.divider,
              backgroundColor: palette.surface,
            },
          ]}
        >
          <View>
            <Text
              style={[
                modalStyles.attachmentHeaderTitle,
                { color: palette.text },
              ]}
            >
              Attachments
            </Text>
            <Text
              style={[
                modalStyles.attachmentHeaderSubtitle,
                { color: palette.subtext },
              ]}
            >
              Existing: {panelFeedExistingAttachments.length} • New:{' '}
              {panelFeedAssets.length}
            </Text>
          </View>
          <KISButton
            title={`Attach media${
              panelFeedAssets.length ? ` (${panelFeedAssets.length})` : ''
            }`}
            variant="outline"
            onPress={handlePickFeedMedia}
            size="sm"
          />
        </View>

        {panelFeedExistingAttachments.length > 0 ? (
          <View style={modalStyles.attachmentGroup}>
            <Text
              style={[
                modalStyles.attachmentGroupTitle,
                { color: palette.subtext },
              ]}
            >
              Existing attachments
            </Text>
            {panelFeedExistingAttachments.map((att, index) => (
              <View
                key={`${att?.url ?? att?.name ?? 'attachment'}-${index}`}
                style={[
                  modalStyles.attachmentRow,
                  {
                    borderColor: palette.divider,
                    backgroundColor: palette.surface,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      modalStyles.attachmentName,
                      { color: palette.text },
                    ]}
                  >
                    {att?.name ?? att?.url ?? `Attachment ${index + 1}`}
                  </Text>
                  <Text
                    style={[
                      modalStyles.attachmentType,
                      { color: palette.subtext },
                    ]}
                  >
                    {(
                      att?.media_type ??
                      att?.mime_type ??
                      'file'
                    ).toUpperCase()}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    setPanelFeedExistingAttachments(prev =>
                      prev.filter((_, idx) => idx !== index),
                    )
                  }
                >
                  <Text
                    style={[
                      modalStyles.attachmentRemoveText,
                      { color: palette.danger },
                    ]}
                  >
                    Remove
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {panelFeedAssets.length > 0 ? (
          <View style={modalStyles.attachmentGroup}>
            <Text
              style={[
                modalStyles.attachmentGroupTitle,
                { color: palette.subtext },
              ]}
            >
              New attachments
            </Text>
            {panelFeedAssets.map((asset, index) => (
              <View
                key={`${asset.uri}-${index}`}
                style={[
                  modalStyles.attachmentRow,
                  {
                    borderColor: palette.divider,
                    backgroundColor: palette.surface,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      modalStyles.attachmentName,
                      { color: palette.text },
                    ]}
                  >
                    {asset.fileName || `Attachment ${index + 1}`}
                  </Text>
                  <Text
                    style={[
                      modalStyles.attachmentType,
                      { color: palette.subtext },
                    ]}
                  >
                    {asset.type ?? 'file'}
                  </Text>
                </View>
                <Pressable onPress={() => removeTemporaryFeedAsset(index)}>
                  <Text
                    style={[
                      modalStyles.attachmentRemoveText,
                      { color: palette.danger },
                    ]}
                  >
                    Remove
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={[modalStyles.mediaTypeLabel, { color: palette.subtext }]}>
          Content type
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={modalStyles.mediaTypeScroll}
        >
          {FEED_MEDIA_TYPES.map(type => {
            const selected = panelFeedMediaType === type;
            return (
              <Pressable
                key={type}
                onPress={() => setPanelFeedMediaType(type)}
                style={[
                  modalStyles.mediaTypePill,
                  {
                    backgroundColor: selected
                      ? palette.primarySoft
                      : palette.surface,
                    borderColor: selected ? palette.primary : palette.divider,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selected ? palette.primaryStrong : palette.subtext,
                    fontWeight: '800',
                  }}
                >
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <KISTextInput
          label="Title"
          value={panelFeedItemTitle}
          onChangeText={setPanelFeedItemTitle}
        />
        <KISTextInput
          label="Summary / notes"
          value={panelFeedItemSummary}
          onChangeText={setPanelFeedItemSummary}
          multiline
          style={{ minHeight: 80 }}
        />

        <TypeSpecificForm
          mediaType={panelFeedMediaType}
          options={panelFeedMediaOptions}
          palette={palette}
          onUpdate={onUpdateMediaOptions}
          attachmentCandidates={attachmentCandidates}
          textPreviewContent={panelFeedItemSummary}
        />

        <View style={modalStyles.formActions}>
          <KISButton
            title={
              panelFeedAdding
                ? 'Saving…'
                : editingFeedItemId
                ? 'Update broadcast item'
                : 'Add broadcast item'
            }
            onPress={handleSubmitFeedItem}
            disabled={panelFeedAdding}
          />
          {editingFeedItemId ? (
            <KISButton
              title="Cancel edit"
              variant="secondary"
              onPress={handleCancelFeedEdit}
              disabled={panelFeedAdding}
            />
          ) : null}
        </View>

        {editingFeedItemId ? (
          <Text
            style={[
              styles.managementFormHint,
              { color: palette.primaryStrong },
            ]}
          >
            Editing an existing broadcast item.
          </Text>
        ) : null}
        <Text style={[styles.managementFormHint, { color: palette.subtext }]}>
          Items can be videos, audio, images, files, or text and will appear
          under the Broadcasts tab.
        </Text>
      </View>
    </ScrollView>
  );
}

const COLOR_SWATCHES = [
  'transparent',
  '#FFB703',
  '#118AB2',
  '#06D6A0',
  '#EF476F',
];

const getColorLabel = (color: string) => {
  if (color === 'transparent') return 'None';
  return color.replace('#', '').toUpperCase();
};

type TypeSpecificFormProps = {
  mediaType: FeedMediaType;
  options: FeedMediaOptions;
  palette: KISPalette;
  onUpdate: (
    type: FeedMediaType,
    updates: Partial<FeedMediaOptions[FeedMediaType]>,
  ) => void;
  attachmentCandidates: { key: string; label: string }[];
  textPreviewContent?: string;
};

const TypeSpecificForm: React.FC<TypeSpecificFormProps> = ({
  mediaType,
  options,
  palette,
  onUpdate,
  attachmentCandidates,
  textPreviewContent,
}) => {
  const renderVideoForm = () => {
    const video = options.video;
    const updateVideo = (updates: Partial<FeedMediaOptions['video']>) =>
      onUpdate('video', updates);
    return (
      <View style={modalStyles.typeSection}>
        <Text style={[modalStyles.typeSectionTitle, { color: palette.text }]}>
          Video accents
        </Text>
        <KISTextInput
          label="Thumbnail label"
          value={video.thumbnailLabel}
          onChangeText={value => updateVideo({ thumbnailLabel: value })}
        />
        <Text
          style={[modalStyles.typeSectionLabel, { color: palette.subtext }]}
        >
          Thumbnail from attachment
        </Text>
        {attachmentCandidates.length === 0 ? (
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            Upload an image/video attachment to use as the thumbnail.
          </Text>
        ) : (
          <View style={modalStyles.chipRow}>
            {attachmentCandidates.map(candidate => (
              <StyleChip
                key={candidate.key}
                label={candidate.label}
                active={video.thumbnailAttachmentKey === candidate.key}
                onPress={() =>
                  updateVideo({ thumbnailAttachmentKey: candidate.key })
                }
                palette={palette}
              />
            ))}
          </View>
        )}
        <View style={modalStyles.chipRow}>
          <StyleChip
            label={video.autoPlay ? 'Autoplay on' : 'Autoplay off'}
            active={video.autoPlay}
            onPress={() => updateVideo({ autoPlay: !video.autoPlay })}
            palette={palette}
          />
          <StyleChip
            label={video.showBadge ? 'Highlight badge' : 'No badge'}
            active={video.showBadge}
            onPress={() => updateVideo({ showBadge: !video.showBadge })}
            palette={palette}
          />
        </View>
      </View>
    );
  };

  const renderAudioForm = () => {
    const audio = options.audio;
    const updateAudio = (updates: Partial<FeedMediaOptions['audio']>) =>
      onUpdate('audio', updates);
    const waveforms: Array<FeedMediaOptions['audio']['waveformStyle']> = [
      'classic',
      'modern',
      'minimal',
    ];
    return (
      <View style={modalStyles.typeSection}>
        <Text style={[modalStyles.typeSectionTitle, { color: palette.text }]}>
          Audio accents
        </Text>
        <KISTextInput
          label="Episode notes"
          value={audio.episodeNotes}
          onChangeText={value => updateAudio({ episodeNotes: value })}
        />
        <KISTextInput
          label="Audio mood"
          value={audio.audioMood}
          onChangeText={value => updateAudio({ audioMood: value })}
        />
        <Text
          style={[modalStyles.typeSectionLabel, { color: palette.subtext }]}
        >
          Waveform style
        </Text>
        <View style={modalStyles.chipRow}>
          {waveforms.map(style => (
            <StyleChip
              key={style}
              label={style}
              active={audio.waveformStyle === style}
              onPress={() => updateAudio({ waveformStyle: style })}
              palette={palette}
            />
          ))}
        </View>
        <StyleChip
          label={audio.hasTranscript ? 'Transcript ready' : 'No transcript'}
          active={audio.hasTranscript}
          onPress={() => updateAudio({ hasTranscript: !audio.hasTranscript })}
          palette={palette}
        />
      </View>
    );
  };

  const renderImageForm = () => {
    const image = options.image;
    const updateImage = (updates: Partial<FeedMediaOptions['image']>) =>
      onUpdate('image', updates);
    const borderStyles: FeedMediaOptions['image']['borderStyle'][] = [
      'none',
      'rounded',
      'shadow',
    ];
    const layouts: FeedMediaOptions['image']['layout'][] = [
      'portrait',
      'landscape',
      'square',
    ];
    return (
      <View style={modalStyles.typeSection}>
        <Text style={[modalStyles.typeSectionTitle, { color: palette.text }]}>
          Image accents
        </Text>
        <Text
          style={[modalStyles.typeSectionLabel, { color: palette.subtext }]}
        >
          Border style
        </Text>
        <View style={modalStyles.chipRow}>
          {borderStyles.map(border => (
            <StyleChip
              key={border}
              label={border}
              active={image.borderStyle === border}
              onPress={() => updateImage({ borderStyle: border })}
              palette={palette}
            />
          ))}
        </View>
        <Text
          style={[modalStyles.typeSectionLabel, { color: palette.subtext }]}
        >
          Layout
        </Text>
        <View style={modalStyles.chipRow}>
          {layouts.map(layout => (
            <StyleChip
              key={layout}
              label={layout}
              active={image.layout === layout}
              onPress={() => updateImage({ layout })}
              palette={palette}
            />
          ))}
        </View>
        <KISTextInput
          label="Caption tone"
          value={image.captionTone}
          onChangeText={value => updateImage({ captionTone: value })}
        />
        <Text
          style={[modalStyles.typeSectionLabel, { color: palette.subtext }]}
        >
          Overlay color
        </Text>
        <View style={modalStyles.colorRow}>
          {COLOR_SWATCHES.map(color => (
            <ColorDot
              key={`image-${color}`}
              color={color}
              active={image.overlayColor === color}
              onPress={() => updateImage({ overlayColor: color })}
              palette={palette}
            />
          ))}
        </View>
      </View>
    );
  };

  const renderFileForm = () => {
    const file = options.file;
    const updateFile = (updates: Partial<FeedMediaOptions['file']>) =>
      onUpdate('file', updates);
    return (
      <View style={modalStyles.typeSection}>
        <Text style={[modalStyles.typeSectionTitle, { color: palette.text }]}>
          File controls
        </Text>
        <KISTextInput
          label="Category label"
          value={file.categoryLabel}
          onChangeText={value => updateFile({ categoryLabel: value })}
        />
        <KISTextInput
          label="Visibility note"
          value={file.visibilityNote}
          onChangeText={value => updateFile({ visibilityNote: value })}
        />
        <KISTextInput
          label="Expiry (days)"
          value={file.expiryDays}
          onChangeText={value => updateFile({ expiryDays: value })}
          keyboardType="numeric"
        />
        <StyleChip
          label={file.secureDownload ? 'Secure download' : 'Open download'}
          active={file.secureDownload}
          onPress={() => updateFile({ secureDownload: !file.secureDownload })}
          palette={palette}
        />
      </View>
    );
  };

  const renderTextForm = () => {
    const text = options.text;
    const updateText = (updates: Partial<FeedMediaOptions['text']>) =>
      onUpdate('text', updates);
    const styleKeys: Array<{
      key: keyof Pick<
        FeedMediaOptions['text'],
        'bold' | 'italic' | 'underline' | 'strikethrough'
      >;
      label: string;
    }> = [
      { key: 'bold', label: 'Bold' },
      { key: 'italic', label: 'Italic' },
      { key: 'underline', label: 'Underline' },
      { key: 'strikethrough', label: 'Strike' },
    ];
    const alignments: FeedMediaOptions['text']['alignment'][] = [
      'left',
      'center',
      'right',
    ];
    const fontSizes: FeedMediaOptions['text']['fontSize'][] = [
      'sm',
      'md',
      'lg',
    ];
    const previewText = textPreviewContent?.trim()
      ? textPreviewContent
      : 'Sample broadcast text preview';
    const previewFontSize = fontSizes.includes(text.fontSize)
      ? text.fontSize === 'sm'
        ? 14
        : text.fontSize === 'md'
        ? 16
        : 18
      : 16;
    const decoration = [
      text.underline ? 'underline' : '',
      text.strikethrough ? 'line-through' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const previewStyle: Record<string, any> = {
      fontWeight: text.bold ? '700' : '400',
      fontStyle: text.italic ? 'italic' : 'normal',
      textDecorationLine: decoration || 'none',
      textAlign: text.alignment,
      fontSize: previewFontSize,
      backgroundColor: text.highlightColor || 'transparent',
      padding: 10,
      borderRadius: 12,
    };
    return (
      <View style={modalStyles.typeSection}>
        <Text style={[modalStyles.typeSectionTitle, { color: palette.text }]}>
          Text styling
        </Text>
        <View style={modalStyles.chipRow}>
          {styleKeys.map(style => (
            <StyleChip
              key={style.key}
              label={style.label}
              active={text[style.key]}
              onPress={() =>
                updateText({ [style.key]: !text[style.key] } as Partial<
                  FeedMediaOptions['text']
                >)
              }
              palette={palette}
            />
          ))}
        </View>
        <Text
          style={[modalStyles.typeSectionLabel, { color: palette.subtext }]}
        >
          Alignment
        </Text>
        <View style={modalStyles.chipRow}>
          {alignments.map(alignment => (
            <StyleChip
              key={alignment}
              label={alignment}
              active={text.alignment === alignment}
              onPress={() => updateText({ alignment })}
              palette={palette}
            />
          ))}
        </View>
        <Text
          style={[modalStyles.typeSectionLabel, { color: palette.subtext }]}
        >
          Font size
        </Text>
        <View style={modalStyles.chipRow}>
          {fontSizes.map(size => (
            <StyleChip
              key={size}
              label={size}
              active={text.fontSize === size}
              onPress={() => updateText({ fontSize: size })}
              palette={palette}
            />
          ))}
        </View>
        <Text
          style={[modalStyles.typeSectionLabel, { color: palette.subtext }]}
        >
          Highlight color
        </Text>
        <View style={modalStyles.colorRow}>
          {COLOR_SWATCHES.map(color => (
            <ColorDot
              key={`text-${color}`}
              color={color}
              active={text.highlightColor === color}
              onPress={() => updateText({ highlightColor: color })}
              palette={palette}
            />
          ))}
        </View>
        <View
          style={[
            modalStyles.textPreviewWrapper,
            {
              borderColor: palette.divider,
              backgroundColor:
                text.highlightColor === 'transparent'
                  ? palette.surface
                  : text.highlightColor,
            },
          ]}
        >
          <Text
            style={[
              modalStyles.textPreview,
              previewStyle,
              { color: palette.text },
            ]}
          >
            {previewText}
          </Text>
        </View>
      </View>
    );
  };

  switch (mediaType) {
    case 'video':
      return renderVideoForm();
    case 'audio':
      return renderAudioForm();
    case 'image':
      return renderImageForm();
    case 'file':
      return renderFileForm();
    case 'text':
      return renderTextForm();
    default:
      return null;
  }
};

const StyleChip: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
  palette: KISPalette;
}> = ({ label, active, onPress, palette }) => (
  <Pressable
    onPress={onPress}
    style={[
      modalStyles.styleChip,
      {
        backgroundColor: active ? palette.primarySoft : palette.surface,
        borderColor: active ? palette.primary : palette.divider,
      },
    ]}
  >
    <Text
      style={{
        color: active ? palette.primaryStrong : palette.subtext,
        fontWeight: '600',
      }}
    >
      {label}
    </Text>
  </Pressable>
);

const ColorDot: React.FC<{
  color: string;
  active: boolean;
  onPress: () => void;
  palette: KISPalette;
}> = ({ color, active, onPress, palette }) => (
  <Pressable
    onPress={onPress}
    style={[
      modalStyles.colorOption,
      {
        borderColor: active ? palette.primary : palette.divider,
        backgroundColor: active ? palette.primarySoft : palette.surface,
      },
    ]}
  >
    <View
      style={[
        modalStyles.colorDot,
        {
          borderColor: active ? palette.primaryStrong : palette.divider,
          backgroundColor: color === 'transparent' ? palette.surface : color,
        },
        color === 'transparent' ? modalStyles.colorDotTransparent : null,
        active && modalStyles.colorDotActive,
      ]}
    >
      {active ? (
        <View
          style={[
            modalStyles.colorDotIndicator,
            {
              backgroundColor:
                color === 'transparent'
                  ? palette.primaryStrong
                  : 'rgba(255,255,255,0.92)',
            },
          ]}
        />
      ) : null}
      {color === 'transparent' ? (
        <Text
          style={[
            modalStyles.colorDotTransparentLabel,
            { color: palette.subtext },
          ]}
        >
          /
        </Text>
      ) : null}
    </View>
    <Text
      style={[
        modalStyles.colorOptionLabel,
        { color: active ? palette.primaryStrong : palette.subtext },
      ]}
      numberOfLines={1}
    >
      {getColorLabel(color)}
    </Text>
  </Pressable>
);

const modalStyles = StyleSheet.create({
  panelContent: {
    gap: 14,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  heroStatsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  heroStatTile: {
    flex: 1,
    minHeight: 74,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  heroStatLabel: {
    marginTop: 2,
    fontSize: 11,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },
  sectionHeader: {
    gap: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyStateCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 4,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyStateText: {
    fontSize: 12,
    lineHeight: 16,
  },
  queueList: {
    gap: 10,
  },
  feedCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  feedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  feedTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  feedStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  feedStatusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  feedSummary: {
    fontSize: 12,
    lineHeight: 17,
  },
  feedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feedMetaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  feedMetaDivider: {
    fontSize: 11,
  },
  feedActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  attachmentHeader: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  attachmentHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  attachmentHeaderSubtitle: {
    marginTop: 2,
    fontSize: 11,
  },
  attachmentGroup: {
    gap: 6,
  },
  attachmentGroupTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  attachmentRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachmentName: {
    fontSize: 12,
    fontWeight: '700',
  },
  attachmentType: {
    marginTop: 1,
    fontSize: 11,
  },
  attachmentRemoveText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mediaTypeLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  mediaTypeScroll: {
    marginTop: 2,
  },
  mediaTypePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  formActions: {
    marginTop: 10,
    gap: 8,
  },
  carouselWrapper: {
    marginVertical: 10,
  },
  carouselContent: {
    paddingRight: 10,
  },
  carouselCard: {
    marginRight: 12,
  },
  deleteAttachment: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '700',
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
    backgroundColor: '#ccc',
  },
  typeSection: {
    marginTop: 16,
    gap: 8,
  },
  typeSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  typeSectionLabel: {
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  styleChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  colorOption: {
    width: 64,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotTransparent: {
    borderStyle: 'dashed',
  },
  colorDotActive: {
    borderWidth: 2,
  },
  colorDotIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  colorDotTransparentLabel: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  colorOptionLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  textPreviewWrapper: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  textPreview: {
    lineHeight: 22,
  },
});
