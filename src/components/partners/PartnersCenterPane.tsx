// src/screens/tabs/PartnersCenterPane.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import styles from './partnersStyles';
import { useKISTheme } from '../../theme/useTheme';
import {
  Partner,
  PartnerChannel,
  PartnerCommunity,
  PartnerGroup,
  RIGHT_PEEK_WIDTH,
} from './partnersTypes';
import PartnerAdminsStrip from './center/PartnerAdminsStrip';
import PartnerChannelsSection from './center/PartnerChannelsSection';
import PartnerCommunitiesSection from './center/PartnerCommunitiesSection';
import PartnerCoursesSection from './center/PartnerCoursesSection';
import PartnerGroupsSection from './center/PartnerGroupsSection';
import PartnerHeaderSection from './center/PartnerHeaderSection';
import { KISIcon } from '@/constants/kisIcons';

type Props = {
  selectedPartner: Partner;
  isReadOnly?: boolean;
  selectedGroupId: string | null;
  selectedChannelId: string | null;
  rootGroups: PartnerGroup[];
  rootChannels: PartnerChannel[];
  groupsForPartner: PartnerGroup[];
  communitiesForPartner: PartnerCommunity[];
  expandedCommunities: Record<string, boolean>;
  onToggleCommunity: (communityId: string) => void;
  onGroupPress: (groupId: string) => void;
  onChannelPress: (channelId: string) => void;
  onFeedPress: () => void;
  onCommunityFeedPress: (communityId: string) => void;
  onPartnerHeaderPress: () => void;
};

export default function PartnersCenterPane({
  selectedPartner,
  isReadOnly,
  selectedGroupId,
  selectedChannelId,
  rootGroups,
  rootChannels,
  groupsForPartner,
  communitiesForPartner,
  expandedCommunities,
  onToggleCommunity,
  onGroupPress,
  onChannelPress,
  onFeedPress,
  onCommunityFeedPress,
  onPartnerHeaderPress,
}: Props) {
  const { palette } = useKISTheme();
  const contentAnim = useRef(new Animated.Value(0)).current;
  const [collapsed, setCollapsed] = useState({
    feed: false,
    courses: false,
    channels: false,
    groups: false,
    communities: false,
  });

  const sectionHeaders = useMemo(
    () => ({
      feed: {
        title: 'General feed',
        meta: isReadOnly ? 'Subscriber view' : null,
      },
      courses: { title: 'Courses', meta: 'Lessons & enrollments' },
      channels: { title: 'Channels', meta: `${rootChannels.length} channels` },
      groups: { title: 'Groups', meta: `${rootGroups.length} groups` },
      communities: {
        title: 'Communities',
        meta: `${communitiesForPartner.length} communities`,
      },
    }),
    [
      communitiesForPartner.length,
      isReadOnly,
      rootChannels.length,
      rootGroups.length,
    ],
  );

  const toggleSection = (key: keyof typeof collapsed) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    contentAnim.setValue(0);
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [contentAnim, selectedPartner?.id]);

  return (
    <Animated.View
      style={[
        styles.centerPane,
        {
          marginRight: RIGHT_PEEK_WIDTH,
          backgroundColor: 'transparent',
          opacity: contentAnim,
          transform: [
            {
              translateY: contentAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.centerScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PartnerHeaderSection
          partner={selectedPartner}
          onPress={onPartnerHeaderPress}
        />
        <PartnerAdminsStrip admins={selectedPartner?.admins ?? []} />

        {/* General feed */}
        <Pressable
          onPress={() => toggleSection('feed')}
          style={styles.sectionHeaderRow}
        >
          <Text style={[styles.sectionHeaderText, { color: palette.text }]}>
            {sectionHeaders.feed.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {sectionHeaders.feed.meta ? (
              <Text
                style={[styles.sectionHeaderMeta, { color: palette.subtext }]}
              >
                {sectionHeaders.feed.meta}
              </Text>
            ) : null}
            <KISIcon
              name="chevron-down"
              size={16}
              color={palette.subtext}
              style={{
                transform: [{ rotate: collapsed.feed ? '180deg' : '0deg' }],
              }}
            />
          </View>
        </Pressable>

        {!collapsed.feed ? (
          <Pressable
            onPress={onFeedPress}
            style={({ pressed }) => [
              styles.groupRow,
              {
                backgroundColor: palette.surface,
                borderColor: 'rgba(255,138,51,0.24)',
                shadowColor: palette.shadow ?? '#000',
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
          >
            <View
              style={[
                styles.groupHash,
                { backgroundColor: palette.primarySoft },
              ]}
            >
              <Text
                style={{
                  color: palette.primaryStrong,
                  fontSize: 15,
                  fontWeight: '700',
                }}
              >
                FE
              </Text>
            </View>
            <Text
              style={{
                flex: 1,
                color: palette.text,
                fontSize: 14,
                fontWeight: '600',
              }}
              numberOfLines={1}
            >
              {selectedPartner?.name} feed
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => toggleSection('courses')}
          style={[styles.sectionHeaderRow, { marginTop: 12 }]}
        >
          <Text style={[styles.sectionHeaderText, { color: palette.text }]}>
            {sectionHeaders.courses.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={[styles.sectionHeaderMeta, { color: palette.subtext }]}
            >
              {sectionHeaders.courses.meta}
            </Text>
            <KISIcon
              name="chevron-down"
              size={16}
              color={palette.subtext}
              style={{
                transform: [{ rotate: collapsed.courses ? '180deg' : '0deg' }],
              }}
            />
          </View>
        </Pressable>

        {!collapsed.courses ? (
          <PartnerCoursesSection partner={selectedPartner} />
        ) : null}

        {isReadOnly ? (
          <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 12 }}>
            Subscribe-only accounts can follow feeds but cannot access groups or
            channels.
          </Text>
        ) : (
          <>
            <Pressable
              onPress={() => toggleSection('channels')}
              style={[styles.sectionHeaderRow, { marginTop: 12 }]}
            >
              <Text style={[styles.sectionHeaderText, { color: palette.text }]}>
                {sectionHeaders.channels.title}
              </Text>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text
                  style={[styles.sectionHeaderMeta, { color: palette.subtext }]}
                >
                  {sectionHeaders.channels.meta}
                </Text>
                <KISIcon
                  name="chevron-down"
                  size={16}
                  color={palette.subtext}
                  style={{
                    transform: [
                      { rotate: collapsed.channels ? '180deg' : '0deg' },
                    ],
                  }}
                />
              </View>
            </Pressable>

            {!collapsed.channels ? (
              <PartnerChannelsSection
                rootChannels={rootChannels}
                selectedChannelId={selectedChannelId}
                onChannelPress={onChannelPress}
                showHeader={false}
              />
            ) : null}

            <Pressable
              onPress={() => toggleSection('groups')}
              style={[styles.sectionHeaderRow, { marginTop: 12 }]}
            >
              <Text style={[styles.sectionHeaderText, { color: palette.text }]}>
                {sectionHeaders.groups.title}
              </Text>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text
                  style={[styles.sectionHeaderMeta, { color: palette.subtext }]}
                >
                  {sectionHeaders.groups.meta}
                </Text>
                <KISIcon
                  name="chevron-down"
                  size={16}
                  color={palette.subtext}
                  style={{
                    transform: [
                      { rotate: collapsed.groups ? '180deg' : '0deg' },
                    ],
                  }}
                />
              </View>
            </Pressable>

            {!collapsed.groups ? (
              <PartnerGroupsSection
                rootGroups={rootGroups}
                selectedGroupId={selectedGroupId}
                onGroupPress={onGroupPress}
                showHeader={false}
              />
            ) : null}

            <Pressable
              onPress={() => toggleSection('communities')}
              style={[styles.sectionHeaderRow, { marginTop: 12 }]}
            >
              <Text style={[styles.sectionHeaderText, { color: palette.text }]}>
                {sectionHeaders.communities.title}
              </Text>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text
                  style={[styles.sectionHeaderMeta, { color: palette.subtext }]}
                >
                  {sectionHeaders.communities.meta}
                </Text>
                <KISIcon
                  name="chevron-down"
                  size={16}
                  color={palette.subtext}
                  style={{
                    transform: [
                      { rotate: collapsed.communities ? '180deg' : '0deg' },
                    ],
                  }}
                />
              </View>
            </Pressable>

            {!collapsed.communities ? (
              <PartnerCommunitiesSection
                communities={communitiesForPartner}
                groups={groupsForPartner}
                expandedCommunities={expandedCommunities}
                selectedGroupId={selectedGroupId}
                onToggleCommunity={onToggleCommunity}
                onGroupPress={onGroupPress}
                onCommunityFeedPress={onCommunityFeedPress}
                showHeader={false}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}
