// src/screens/broadcast/channels/GiftMembershipRedeemScreen.tsx
//
// Screen chrome (header, back button, safe area) around
// GiftMembershipRedeem, reached either by navigating in-app or via the
// gift/:token deep link registered in App.tsx. GiftMembershipRedeem itself
// stays a bare content component (no navigation dependency) so it can
// also be embedded elsewhere later without dragging a screen header along.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import GiftMembershipRedeem from './components/GiftMembershipRedeem';

type Props = NativeStackScreenProps<RootStackParamList, 'GiftMembershipRedeem'>;

export default function GiftMembershipRedeemScreen({ route, navigation }: Props) {
  const { palette } = useKISTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>Gift Membership</Text>
      </View>
      <GiftMembershipRedeem
        token={route.params?.token}
        onSuccess={() => {
          // Stays on the success card GiftMembershipRedeem itself renders -
          // nothing else to navigate to, this screen's whole job was
          // getting the user here.
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  backBtn: { padding: 2, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '900' },
});
