import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import PermanentRemoteImage from '@/components/media/PermanentRemoteImage';

export type PollVotesSheetOption = {
  id: string;
  text: string;
  voterIds?: string[];
};

type Voter = {
  id: string;
  name?: string;
  phone?: string;
  avatarUrl?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  palette: any;
  question: string;
  options: PollVotesSheetOption[];
  participantMap?: Record<string, string>;
  participantAvatarMap?: Record<string, string>;
  participantPhoneMap?: Record<string, string>;
};

const initialsFor = (label: string): string =>
  label
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

export default function PollVotesSheet({
  visible,
  onClose,
  palette,
  question,
  options,
  participantMap,
  participantAvatarMap,
  participantPhoneMap,
}: Props) {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  const resolveVoter = (id: string): Voter => ({
    id,
    name: participantMap?.[id],
    phone: participantPhoneMap?.[id],
    avatarUrl: participantAvatarMap?.[id],
  });

  const sections = useMemo(
    () =>
      options.map((opt) => {
        const voterIds = Array.isArray(opt.voterIds) ? opt.voterIds : [];
        return {
          title: opt.text,
          count: voterIds.length,
          data: voterIds.map(resolveVoter),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, participantMap, participantAvatarMap, participantPhoneMap],
  );

  const totalVotes = sections.reduce((sum, s) => sum + s.count, 0);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: palette.surface ?? palette.bg, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.handle} >
          <View style={[styles.handleBar, { backgroundColor: palette.divider }]} />
        </View>

        <View style={[styles.header, { borderBottomColor: palette.divider }]}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
              {question}
            </Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              {totalVotes} vote{totalVotes === 1 ? '' : 's'}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <KISIcon name="close" size={22} color={palette.text} />
          </Pressable>
        </View>

        <SectionList
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews
          sections={sections}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={{ paddingBottom: 24 }}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: palette.surface ?? palette.bg, borderBottomColor: palette.divider }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]} numberOfLines={1}>
                {section.title}
              </Text>
              <View style={[styles.countPill, { backgroundColor: (palette.primary ?? '#6366F1') + '1F' }]}>
                <Text style={[styles.countPillText, { color: palette.primary ?? '#6366F1' }]}>
                  {section.count}
                </Text>
              </View>
            </View>
          )}
          renderItem={({ item, index, section }) => {
            const label = item.name || item.phone || 'Member';
            const secondary = item.name && item.phone ? item.phone : undefined;
            const isLast = index === section.data.length - 1;
            return (
              <View
                style={[
                  styles.voterRow,
                  !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.divider },
                ]}
              >
                {item.avatarUrl ? (
                  <PermanentRemoteImage
                    uri={item.avatarUrl}
                    domain="Chat"
                    stableKey={`poll_voter_${item.id}`}
                    containerStyle={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: palette.surfaceSoft ?? palette.surface }]}>
                    <Text style={{ color: palette.subtext, fontSize: 13, fontWeight: '700' }}>
                      {initialsFor(label)}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.voterName, { color: palette.text }]} numberOfLines={1}>
                    {label}
                  </Text>
                  {secondary ? (
                    <Text style={[styles.voterSecondary, { color: palette.subtext }]} numberOfLines={1}>
                      {secondary}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          }}
          renderSectionFooter={({ section }) =>
            section.data.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>No votes yet.</Text>
              </View>
            ) : null
          }
        />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // 40% of the device's available screen height per spec - the parent
    // Modal (opened from MessageBubble) already occupies the full window,
    // so a percentage height here maps directly to 40% of the device.
    height: '40%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handle: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', flex: 1, marginRight: 8 },
  countPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countPillText: { fontSize: 11, fontWeight: '700' },
  voterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  voterName: { fontSize: 14, fontWeight: '600' },
  voterSecondary: { fontSize: 12, marginTop: 2 },
  emptySection: { paddingHorizontal: 18, paddingVertical: 10 },
});
