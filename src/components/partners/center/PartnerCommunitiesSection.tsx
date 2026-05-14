import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import styles from '@/components/partners/partnersStyles';
import {
  PartnerCommunity,
  PartnerGroup,
} from '@/components/partners/partnersTypes';

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
  const { palette, tone } = useKISTheme();
  const metallicGoldGradient = tone === 'dark'
    ? ['#3B271E', '#6F4515', '#B9852E', '#56321F']
    : ['#5A372D', '#8A5A12', '#D9A875', '#7A4B3E'];

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

      {communities.map(community => {
        const isExpanded = expandedCommunities[community.id] ?? true;
        const communityGroups = groups.filter(
          g => g.community === community.id,
        );

        return (
          <View
            key={community.id}
            style={[
              styles.communityCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.borderMuted,
                shadowColor: palette.shadow ?? '#000',
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
              <Text
                style={{
                  color: palette.primaryStrong,
                  fontSize: 18,
                  marginLeft: 8,
                  fontWeight: '900',
                }}
              >
                {isExpanded ? 'v' : '>'}
              </Text>
            </Pressable>

            {isExpanded && (
              <>
                <Pressable
                  onPress={() => onCommunityFeedPress(community.id)}
                  style={({ pressed }) => [
                    styles.communityGroupRow,
                    {
                      backgroundColor:
                        palette.surfaceElevated ?? palette.surface,
                      borderColor: palette.borderMuted,
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
                        fontSize: 13,
                        fontWeight: '900',
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
                    Feed
                  </Text>
                </Pressable>
                {communityGroups.map(group => {
                  const isSelected = group.id === selectedGroupId;
                  return (
                    <Pressable
                      key={group.id}
                      onPress={() => onGroupPress(group.id)}
                      style={({ pressed }) => [
                        styles.communityGroupRow,
                        {
                          backgroundColor: isSelected
                            ? palette.goldDeep
                            : palette.surfaceElevated ?? palette.surface,
                          borderColor: isSelected
                            ? palette.goldLight
                            : palette.borderMuted,
                          overflow: 'hidden',
                          opacity: pressed ? 0.8 : 1,
                          transform: [{ scale: pressed ? 0.985 : 1 }],
                        },
                      ]}
                    >
                      {isSelected ? (
                        <LinearGradient
                          colors={metallicGoldGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFillObject}
                        />
                      ) : null}
                      {isSelected ? <View pointerEvents="none" style={localStyles.goldSheen} /> : null}
                      <View
                        style={[
                          styles.groupHash,
                          {
                            backgroundColor: isSelected
                              ? 'rgba(255,255,255,0.18)'
                              : palette.primarySoft,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: isSelected
                              ? palette.ivory
                              : palette.primaryStrong,
                            fontSize: 15,
                            fontWeight: '900',
                          }}
                        >
                          #
                        </Text>
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          color: isSelected
                            ? palette.ivory
                            : palette.text,
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

const localStyles = StyleSheet.create({
  goldSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.14)',
    transform: [{ translateX: -22 }, { rotate: '-18deg' }, { scaleX: 0.36 }],
  },
});
