import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { KISPalette } from '@/theme/constants';
import { walletModes } from '../profile/profile.constants';

import { styles } from '../profile/profile.styles';

type WalletModalProps = {
  palette: KISPalette;
  walletForm: Record<string, any>;
  setWalletForm: React.Dispatch<React.SetStateAction<any>>;
  setWalletRecipient?: (value: string) => void;
  walletRecipientVerification?: {
    checking: boolean;
    verified: boolean;
    recipientName: string;
    recipientPhoneDisplay: string;
    error: string;
  };
  verifyWalletRecipient?: () => Promise<void>;
  saving: boolean;
  submitWalletAction?: () => Promise<void>;
  lastWalletPaymentUrl?: string;
};

export function WalletModal(props: WalletModalProps) {
  const {
    palette,
    walletForm,
    setWalletForm,
  } = props;

  const mode = String(walletForm.mode || 'history').trim().toLowerCase();
  const legacyActionMode = ['add_kisc', 'deposit', 'cash_to_credits', 'transfer'].includes(mode);

  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.subtext, { color: palette.subtext }]}>
        KIS promotional credits are gift/reward credits for eligible platform benefits. They cannot be bought, transferred, withdrawn, sold, or converted to cash.
      </Text>
      <Text style={[styles.subtext, { color: palette.subtext }]}>
        Historical wallet, ledger, billing, and receipt records remain available for review.
      </Text>

      <View style={styles.walletModeRow}>
        {walletModes.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setWalletForm((s: any) => ({ ...s, mode: item.value }))}
            style={[
              styles.walletModeChip,
              {
                backgroundColor: walletForm.mode === item.value ? palette.primarySoft : palette.surface,
                borderColor: palette.divider,
              },
            ]}
          >
            <Text style={{ color: palette.text, fontSize: 12 }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {legacyActionMode ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: palette.divider,
            backgroundColor: palette.surface,
            borderRadius: 12,
            padding: 12,
            gap: 6,
          }}
        >
          <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>
            This wallet action is unavailable
          </Text>
          <Text style={[styles.subtext, { color: palette.subtext }]}>
            Buying, sending, withdrawing, or converting KIS promotional credits is disabled. Use secure USD checkout for paid account upgrades.
          </Text>
        </View>
      ) : (
        <View
          style={{
            borderWidth: 1,
            borderColor: palette.divider,
            backgroundColor: palette.surface,
            borderRadius: 12,
            padding: 12,
            gap: 6,
          }}
        >
          <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>
            Read-only credit center
          </Text>
          <Text style={[styles.subtext, { color: palette.subtext }]}>
            Promotional credits can only subsidize eligible KIS account upgrades when that option is available.
          </Text>
        </View>
      )}
    </View>
  );
}
