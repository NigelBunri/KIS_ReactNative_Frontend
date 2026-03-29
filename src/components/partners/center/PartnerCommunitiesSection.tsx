import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import styles from '@/components/partners/partnersStyles';
import { PartnerCommunity, PartnerGroup } from '@/components/partners/partnersTypes';

type Props = {
  communities: PartnerCommunity[];
  groups: PartnerGroup[];
  expandedCommunities: Record<string, boolean>;
  selectedGroupId: string | null;
  onToggleCommunity: (communityId: string) => void;
  onGroupPress: (groupId: string) => void;
  onCommunityFeedPress: (communityId: string) => void;
  showHeader?: boolean;
};

export default function PartnerCommunitiesSection({
  communities,
  groups,
  expandedCommunities,
  selectedGroupId,
  onToggleCommunity,
  onGroupPress,
  onCommunityFeedPress,
  showHeader = true,
}: Props) {
  const { palette } = useKISTheme();

  if (communities.length === 0) return null;

  return (
    <>
      {showHeader ? (
        <View style={[styles.sectionHeaderRow, { marginTop: 12 }]}>
          <Text style={[styles.sectionHeaderText, { color: palette.text }]}>
            Communities
          </Text>
          <Text style={[styles.sectionHeaderMeta, { color: palette.subtext }]}>
            {communities.length} communities
          </Text>
        </View>
      ) : null}

      {communities.map((community) => {
        const isExpanded = expandedCommunities[community.id] ?? true;
        const communityGroups = groups.filter((g) => g.community === community.id);

        return (
          <View
            key={community.id}
            style={[
              styles.communityCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.borderMuted,
              },
            ]}
          >
            <Pressable
              onPress={() => onToggleCommunity(community.id)}
              style={({ pressed }) => [
                styles.communityHeaderRow,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: palette.text,
                    fontSize: 14,
                    fontWeight: '700',
                  }}
                  numberOfLines={1}
                >
                  {community.name}
                </Text>
                {community.description ? (
                  <Text
                    style={{
                      color: palette.subtext,
                      fontSize: 12,
                      marginTop: 2,
                    }}
                    numberOfLines={2}
                  >
                    {community.description}
                  </Text>
                ) : null}
              </View>
              <Text style={{ color: palette.subtext, fontSize: 16, marginLeft: 8 }}>
                {isExpanded ? '⌄' : '›'}
              </Text>
            </Pressable>

            {isExpanded && (
              <>
                <Pressable
                  onPress={() => onCommunityFeedPress(community.id)}
                  style={({ pressed }) => [
                    styles.communityGroupRow,
                    {
                      backgroundColor: palette.surfaceElevated ?? palette.surface,
                      borderColor: palette.borderMuted,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={styles.groupHash}>
                    <Text style={{ color: palette.subtext, fontSize: 15, fontWeight: '700' }}>
                      📰
                    </Text>
                  </View>
                  <Text style={{ flex: 1, color: palette.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                    Feed
                  </Text>
                </Pressable>
                {communityGroups.map((group) => {
                  const isSelected = group.id === selectedGroupId;
                  return (
                    <Pressable
                      key={group.id}
                      onPress={() => onGroupPress(group.id)}
                      style={({ pressed }) => [
                        styles.communityGroupRow,
                        {
                          backgroundColor: isSelected
                            ? palette.primarySoft
                            : palette.surfaceElevated ?? palette.surface,
                          borderColor: isSelected
                            ? palette.primaryStrong
                            : palette.borderMuted,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <View style={styles.groupHash}>
                        <Text style={{ color: palette.subtext, fontSize: 15, fontWeight: '700' }}>
                          #
                        </Text>
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          color: isSelected ? palette.primaryStrong : palette.text,
                          fontSize: 14,
                          fontWeight: isSelected ? '700' : '400',
                        }}
                        numberOfLines={1}
                      >
                        {group.name.replace(/^#\s*/i, '')}
                      </Text>
                    </Pressable>
                  );
                })}
              </>
            )}
          </View>
        );
      })}
    </>
  );
}
