import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { useResponsiveLayout } from '@/theme/responsive';

type Props = {
  title: string;
  tierLabel?: string;
  onCreate?: () => void;
  onSearch?: () => void;
};

export default function BroadcastHeaderBar({
  title,
  tierLabel = 'Business Pro',
  onCreate,
  onSearch,
}: Props) {
  const { palette, tokens, tone } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const headerTextColor = palette.ivory ?? '#FFFFFF';
  const headerMutedColor = tone === 'dark' ? '#FFF4B8' : '#FFFFFF';
  const isDark = tone === 'dark';
  const controlBg = isDark ? palette.primarySoft : 'rgba(255,255,255,0.9)';
  const controlBorder = isDark ? palette.goldMuted : palette.goldLight;
  const controlText = isDark ? palette.primaryStrong : palette.primaryStrong;
  const createBg = isDark ? palette.primarySoft : palette.primaryStrong;
  const createText = isDark ? palette.primaryStrong : '#FFFFFF';
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  return (
    <View style={styles.shell}>
      <View style={[styles.row, compact && styles.rowCompact]}>
        <View style={styles.leftCluster}>
          <View
            style={[
              styles.mark,
              { backgroundColor: controlBg, borderColor: controlBorder, width: compact ? 34 : 40, height: compact ? 34 : 40, borderRadius: compact ? 14 : 16 },
            ]}
          >
            <KISIcon name="megaphone" size={18} color={controlText} />
          </View>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: headerTextColor, fontSize: compact ? 18 : 22 }]} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.metaRow}>
              <Text style={[styles.eyebrow, { color: headerMutedColor }]} numberOfLines={1}>
                Studio signal
              </Text>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: controlBg,
                    borderColor: controlBorder,
                  },
                ]}
              >
                <KISIcon name="shield" size={9} color={controlText} />
                <Text
                  style={{
                    color: controlText,
                    fontWeight: '900',
                    fontSize: 8,
                  }}
                  numberOfLines={1}
                >
                  {tierLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.actions, compact && styles.actionsCompact]}>
          {onSearch && (
            <Pressable
              onPress={onSearch}
              style={[
                styles.createBtn,
                {
                  backgroundColor: controlBg,
                  borderColor: controlBorder,
                  borderWidth: 1,
                  paddingHorizontal: compact ? 9 : 12,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Search"
            >
              <KISIcon name="search" size={16} color={controlText} />
            </Pressable>
          )}
          <Pressable
            onPress={onCreate}
            style={[
              styles.createBtn,
              {
                backgroundColor: createBg,
                borderColor: isDark ? palette.goldMuted : 'transparent',
                borderWidth: isDark ? 1 : 0,
              },
            ]}
            accessibilityRole="button"
          >
            <KISIcon name="plus" size={16} color={createText} />
            {responsive.isWatch ? null : (
              <Text style={{ color: createText, fontWeight: '900', lineHeight: 16 }}>
                Create
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (_tokens: any) =>
  StyleSheet.create({
    shell: {
      paddingHorizontal: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      minWidth: 0,
    },
    rowCompact: {
      gap: 8,
    },
    leftCluster: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
      flex: 1,
      minWidth: 0,
      flexShrink: 1,
    },
    titleBlock: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      minWidth: 0,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    actionsCompact: {
      gap: 5,
    },
    mark: {
      width: 40,
      height: 40,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    title: {
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: 0,
    },
    badge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 4,
      paddingVertical: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      minHeight: 14,
      maxWidth: 96,
    },
    createBtn: {
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      minHeight: 42,
      paddingVertical: 9,
      justifyContent: 'center',
    },
  });
