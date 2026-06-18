import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';

export type MediaGalleryProps = {
  visible: boolean;
  messages: any[]; // ChatMessage[]
  palette: any;
  onClose: () => void;
};

type MediaTab = 'Images' | 'Videos' | 'Documents';

type MediaItem = {
  key: string;
  url: string;
  mimeType?: string;
  kind?: string;
  originalName?: string;
  tab: MediaTab;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SIZE = Math.floor((SCREEN_WIDTH - 4) / COLUMN_COUNT);

const TABS: MediaTab[] = ['Images', 'Videos', 'Documents'];

const classifyItem = (att: any): MediaTab | null => {
  const mime: string = att?.mimeType ?? att?.mimetype ?? att?.mime ?? '';
  const kind: string = att?.kind ?? '';

  if (kind === 'image' || mime.startsWith('image/')) return 'Images';
  if (kind === 'video' || mime.startsWith('video/')) return 'Videos';
  if (
    kind === 'file' ||
    kind === 'document' ||
    kind === 'other' ||
    mime.startsWith('application/') ||
    mime.startsWith('text/')
  ) {
    return 'Documents';
  }
  // Fall back by extension on the URL
  const url: string = att?.url ?? att?.uri ?? '';
  const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase();
  if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) {
    return 'Images';
  }
  if (ext && ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return 'Videos';
  }
  if (ext && ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) {
    return 'Documents';
  }
  return null;
};

const extractMediaItems = (messages: any[]): MediaItem[] => {
  const items: MediaItem[] = [];
  for (const msg of messages) {
    const attachments: any[] = Array.isArray(msg?.attachments) ? msg.attachments : [];
    for (const att of attachments) {
      const url: string = att?.url ?? att?.uri ?? '';
      if (!url) continue;
      const tab = classifyItem(att);
      if (!tab) continue;
      items.push({
        key: String(att?.id ?? url),
        url,
        mimeType: att?.mimeType ?? att?.mimetype ?? att?.mime,
        kind: att?.kind,
        originalName: att?.originalName ?? att?.name ?? att?.filename,
        tab,
      });
    }
  }
  return items;
};

export const MediaGallery: React.FC<MediaGalleryProps> = ({
  visible,
  messages,
  palette,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<MediaTab>('Images');
  const [fullscreenItem, setFullscreenItem] = useState<MediaItem | null>(null);

  const allMedia = useMemo(() => extractMediaItems(messages), [messages]);
  const filtered = useMemo(
    () => allMedia.filter((item) => item.tab === activeTab),
    [allMedia, activeTab],
  );

  const renderGridItem = ({ item }: { item: MediaItem }) => {
    const isVideo = item.tab === 'Videos';
    const isDocument = item.tab === 'Documents';

    return (
      <Pressable
        onPress={() => setFullscreenItem(item)}
        style={[
          styles.gridItem,
          { backgroundColor: palette.surfaceSoft ?? palette.surface },
        ]}
      >
        {isDocument ? (
          <View style={styles.docThumb}>
            <KISIcon name="file" size={32} color={palette.primary} />
            <Text
              numberOfLines={2}
              style={[styles.docName, { color: palette.text }]}
            >
              {item.originalName ?? 'Document'}
            </Text>
          </View>
        ) : (
          <>
            <Image
              source={{ uri: item.url }}
              style={styles.gridImage}
              resizeMode="cover"
            />
            {isVideo && (
              <View style={styles.videoOverlay}>
                <KISIcon name="play" size={22} color="#fff" />
              </View>
            )}
          </>
        )}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View
        style={[
          styles.root,
          { backgroundColor: palette.bg ?? palette.surface, paddingTop: insets.top },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <KISIcon name="arrow-left" size={22} color={palette.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]}>
            Media
          </Text>
        </View>

        {/* Tabs */}
        <View style={[styles.tabRow, { borderBottomColor: palette.divider }]}>
          {TABS.map((tab) => {
            const count = allMedia.filter((i) => i.tab === tab).length;
            const isActive = tab === activeTab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tabBtn,
                  isActive && {
                    borderBottomWidth: 2,
                    borderBottomColor: palette.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: isActive
                        ? palette.primary
                        : palette.subtext,
                      fontWeight: isActive ? '700' : '400',
                    },
                  ]}
                >
                  {tab}
                  {count > 0 ? ` (${count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Grid */}
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              No {activeTab.toLowerCase()} in this conversation.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.key}
            numColumns={COLUMN_COUNT}
            renderItem={renderGridItem}
            contentContainerStyle={styles.grid}
          />
        )}
      </View>

      {/* Full-screen viewer */}
      {fullscreenItem && (
        <Modal
          visible={!!fullscreenItem}
          transparent
          animationType="fade"
          onRequestClose={() => setFullscreenItem(null)}
        >
          <View style={styles.fullscreenBg}>
            <Pressable
              onPress={() => setFullscreenItem(null)}
              style={styles.fullscreenClose}
            >
              <KISIcon name="close" size={22} color="#fff" />
            </Pressable>
            {fullscreenItem.tab === 'Documents' ? (
              <View style={styles.fullscreenDocCard}>
                <KISIcon name="file" size={48} color={palette.primary} />
                <Text style={[styles.fullscreenDocName, { color: palette.text }]}>
                  {fullscreenItem.originalName ?? 'Document'}
                </Text>
              </View>
            ) : (
              <Image
                source={{ uri: fullscreenItem.url }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 6, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabText: { fontSize: 14 },
  grid: { paddingBottom: 24 },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridImage: { width: '100%', height: '100%' },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  docThumb: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  docName: { fontSize: 10, marginTop: 6, textAlign: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14 },
  fullscreenBg: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenClose: {
    position: 'absolute',
    top: 48,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  fullscreenImage: { width: '100%', height: '100%' },
  fullscreenDocCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  fullscreenDocName: { fontSize: 16, marginTop: 12, textAlign: 'center' },
});

export default MediaGallery;
