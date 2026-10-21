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
import WorkStatusRing from '@/components/common/WorkStatusRing';

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
  workStatus?: string;
  status: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  palette: any;
  question: string;
  options: PollVotesSheetOption[];
  participantMap?: Record<string, string>;
  participantAvatarMap?: Record<string, string>;
  participantWorkStatusMap?: Record<string, string>;
  participantPhoneMap?: Record<string, string>;
  participantRoleMap?: Record<string, string>;
  isDirectChat?: boolean;
};

const initialsFor = (label: string): string =>
  label
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

// A 1-to-1 chat has no group/community role concept at all - the other
// party is simply a contact, regardless of whatever base_role their
// ConversationMember row happens to carry. Otherwise: owner/admin/mod all
// read as "Admin" (matches the Owner/Admin badge split used elsewhere,
// e.g. ChatInfoPage.tsx's own member list), anything else is "Member".
const statusFor = (role: string | undefined, isDirectChat: boolean | undefined): string => {
  if (isDirectChat) return 'Contact';
  const normalized = (role ?? '').toLowerCase();
  if (normalized === 'owner') return 'Owner';
  if (normalized === 'admin' || normalized === 'mod' || normalized === 'moderator') return 'Admin';
  return 'Member';
};

export default function PollVotesSheet({
  visible,
  onClose,
  palette,
  question,
  options,
  participantMap,
  participantAvatarMap,
  participantWorkStatusMap,
  participantPhoneMap,
  participantRoleMap,
  isDirectChat,
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
    workStatus: participantWorkStatusMap?.[id],
    status: statusFor(participantRoleMap?.[id], isDirectChat),
  });

  // Recomputes on every render while the sheet is open (not just once on
  // mount) - `options` is a fresh array built by MessageBubble's
  // renderPollCard on every render, so a live 'chat.poll_updated' socket
  // event (see useChatMessaging.ts) that updates the message's poll while
  // this sheet is already open flows straight through to a new voter list
  // here, with no need to close and reopen the sheet to see it.
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
    [options, participantMap, participantAvatarMap, participantWorkStatusMap, participantPhoneMap, participantRoleMap, isDirectChat],
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
                <WorkStatusRing size={36} workStatus={item.workStatus}>
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
                </WorkStatusRing>
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
                {(() => {
                  const statusColor =
                    item.status === 'Owner'
                      ? '#F59E0B'
                      : item.status === 'Admin'
                        ? palette.primary ?? '#6366F1'
                        : palette.subtext;
                  const tinted = item.status === 'Owner' || item.status === 'Admin';
                  return (
                    <View
                      style={[
                        styles.statusPill,
                        tinted
                          ? { backgroundColor: statusColor + '1F', borderColor: statusColor + '40', borderWidth: 1 }
                          : { backgroundColor: palette.surfaceSoft ?? palette.surface },
                      ]}
                    >
                      <Text style={{ color: statusColor, fontSize: 11, fontWeight: '700' }}>
                        {item.status}
                      </Text>
                    </View>
                  );
                })()}
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
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginLeft: 8 },
  emptySection: { paddingHorizontal: 18, paddingVertical: 10 },
});
