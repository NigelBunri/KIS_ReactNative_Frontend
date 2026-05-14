import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import styles from '@/components/partners/partnersStyles';
import { PartnerChannel } from '@/components/partners/partnersTypes';

type Props = {
  rootChannels: PartnerChannel[];
  selectedChannelId: string | null;
  onChannelPress: (channelId: string) => void;
  showHeader?: boolean;
};

export default function PartnerChannelsSection({
  rootChannels,
  selectedChannelId,
  onChannelPress,
  showHeader = true,
}: Props) {
  const { palette, tone } = useKISTheme();
  const metallicGoldGradient = tone === 'dark'
    ? ['#3B271E', '#6F4515', '#B9852E', '#56321F']
    : ['#5A372D', '#8A5A12', '#D9A875', '#7A4B3E'];

  return (
    <>
      {showHeader ? (
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeaderText, { color: palette.text }]}>
            Channels
          </Text>
          <Text style={[styles.sectionHeaderMeta, { color: palette.subtext }]}>
            {rootChannels.length} channels
          </Text>
        </View>
      ) : null}

      {rootChannels.length === 0 ? (
        <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 8 }}>
          No standalone channels yet.
        </Text>
      ) : (
        rootChannels.map(item => {
          const isSelected = item.id === selectedChannelId;
          return (
            <Pressable
              key={item.id}
              onPress={() => onChannelPress(item.id)}
              style={({ pressed }) => [
                styles.groupRow,
                {
                  backgroundColor: isSelected
                    ? palette.goldDeep
                    : palette.surfaceElevated ?? palette.surface,
                  borderColor: isSelected
                    ? palette.goldLight
                    : palette.borderMuted,
                  overflow: 'hidden',
                  shadowColor: palette.shadow ?? '#000',
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
                  !
                </Text>
              </View>
              <Text
                style={{
                  flex: 1,
                  color: isSelected ? palette.ivory : palette.text,
                  fontSize: 14,
                  fontWeight: isSelected ? '700' : '400',
                }}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        })
      )}
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
