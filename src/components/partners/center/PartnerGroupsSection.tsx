import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import styles from '@/components/partners/partnersStyles';
import { PartnerGroup } from '@/components/partners/partnersTypes';

type Props = {
  rootGroups: PartnerGroup[];
  selectedGroupId: string | null;
  onGroupPress: (groupId: string) => void;
  showHeader?: boolean;
};

export default function PartnerGroupsSection({
  rootGroups,
  selectedGroupId,
  onGroupPress,
  showHeader = true,
}: Props) {
  const { palette } = useKISTheme();

  return (
    <>
      {showHeader ? (
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeaderText, { color: palette.text }]}>
            Groups
          </Text>
          <Text style={[styles.sectionHeaderMeta, { color: palette.subtext }]}>
            {rootGroups.length} groups
          </Text>
        </View>
      ) : null}

      {rootGroups.length === 0 ? (
        <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 8 }}>
          No standalone groups yet.
        </Text>
      ) : (
        rootGroups.map(item => {
          const isSelected = item.id === selectedGroupId;
          return (
            <Pressable
              key={item.id}
              onPress={() => onGroupPress(item.id)}
              style={({ pressed }) => [
                styles.groupRow,
                {
                  backgroundColor: isSelected
                    ? palette.primarySoft
                    : palette.surfaceElevated ?? palette.surface,
                  borderColor: isSelected
                    ? palette.primaryStrong
                    : palette.borderMuted,
                  shadowColor: palette.shadow ?? '#000',
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              <View
                style={[
                  styles.groupHash,
                  {
                    backgroundColor: isSelected
                      ? palette.primaryStrong
                      : palette.primarySoft,
                  },
                ]}
              >
                <Text
                  style={{
                    color: isSelected
                      ? palette.onPrimary
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
                  color: isSelected ? palette.primaryStrong : palette.text,
                  fontSize: 14,
                  fontWeight: isSelected ? '700' : '400',
                }}
                numberOfLines={1}
              >
                {item.name.replace(/^#\s*/i, '')}
              </Text>
            </Pressable>
          );
        })
      )}
    </>
  );
}
