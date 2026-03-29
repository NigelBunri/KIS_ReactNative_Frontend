import React from 'react';
import { Pressable, Text, View } from 'react-native';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import type { KISPalette } from '@/theme/constants';
import { paymentProviders, walletModes } from '../profile/profile.constants';

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
    setWalletRecipient,
    walletRecipientVerification,
    verifyWalletRecipient,
    saving,
    submitWalletAction,
    lastWalletPaymentUrl,
  } = props;

  const transferMode = String(walletForm.mode || '').trim().toLowerCase() === 'transfer';
  const submitDisabled = saving || (transferMode && !walletRecipientVerification?.verified);

  const handleSubmit = async () => {
    await submitWalletAction?.();
    if (lastWalletPaymentUrl) return;
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.subtext, { color: palette.subtext }]}>
        Manage your KIS Coin wallet. 1 KISC = $100 USD.
      </Text>

      <View style={styles.walletModeRow}>
        {walletModes.map((mode) => (
          <Pressable
            key={mode.value}
            onPress={() => setWalletForm((s: any) => ({ ...s, mode: mode.value }))}
            style={[
              styles.walletModeChip,
              {
                backgroundColor: walletForm.mode === mode.value ? palette.primarySoft : palette.surface,
                borderColor: palette.divider,
              },
            ]}
          >
            <Text style={{ color: palette.text, fontSize: 12 }}>{mode.label}</Text>
          </Pressable>
        ))}
      </View>

      {walletForm.mode === 'add_kisc' && (
        <>
          <View style={styles.walletModeRow}>
            {paymentProviders.map((provider) => (
              <Pressable
                key={provider.value}
                onPress={() => setWalletForm((s: any) => ({ ...s, provider: provider.value }))}
                style={[
                  styles.walletModeChip,
                  {
                    backgroundColor: walletForm.provider === provider.value ? palette.primarySoft : palette.surface,
                    borderColor: palette.divider,
                  },
                ]}
              >
                <Text style={{ color: palette.text, fontSize: 12 }}>{provider.label}</Text>
              </Pressable>
            ))}
          </View>

          <KISTextInput
            label="Amount (KISC)"
            value={walletForm.amount}
            onChangeText={(t) => setWalletForm((s: any) => ({ ...s, amount: t }))}
            keyboardType="decimal-pad"
          />
          <KISTextInput
            label="Reference (optional)"
            value={walletForm.reference}
            onChangeText={(t) => setWalletForm((s: any) => ({ ...s, reference: t }))}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      )}

      {walletForm.mode === 'spend_kisc' && (
        <>
          <KISTextInput
            label="Amount (KISC)"
            value={walletForm.amount}
            onChangeText={(t) => setWalletForm((s: any) => ({ ...s, amount: t }))}
            keyboardType="decimal-pad"
          />
          <KISTextInput
            label="Reference (optional)"
            value={walletForm.reference}
            onChangeText={(t) => setWalletForm((s: any) => ({ ...s, reference: t }))}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      )}

      {walletForm.mode === 'transfer' && (
        <>
          <KISTextInput
            label="Recipient phone (with or without country code)"
            value={walletForm.recipient}
            onChangeText={(t) => {
              if (setWalletRecipient) {
                setWalletRecipient(t);
                return;
              }
              setWalletForm((s: any) => ({ ...s, recipient: t }));
            }}
          />
          <KISButton
            title={walletRecipientVerification?.checking ? 'Verifying...' : 'Verify receiver'}
            onPress={verifyWalletRecipient}
            disabled={saving || walletRecipientVerification?.checking || !String(walletForm.recipient || '').trim()}
          />
          {walletRecipientVerification?.verified ? (
            <View style={{ gap: 4 }}>
              <Text style={{ color: (palette as any).success || palette.primaryStrong, fontSize: 13, fontWeight: '700' }}>
                Receiver: {walletRecipientVerification.recipientName}
              </Text>
              <Text style={{ color: palette.text, fontSize: 12 }}>
                Number: {walletRecipientVerification.recipientPhoneDisplay}
              </Text>
            </View>
          ) : walletRecipientVerification?.error ? (
            <Text style={{ color: (palette as any).danger || palette.primaryStrong, fontSize: 12 }}>
              {walletRecipientVerification.error}
            </Text>
          ) : null}
          <KISTextInput
            label="Amount (KISC)"
            value={walletForm.amount}
            onChangeText={(t) => setWalletForm((s: any) => ({ ...s, amount: t }))}
            keyboardType="decimal-pad"
          />
          <KISTextInput
            label="Reference (optional)"
            value={walletForm.reference}
            onChangeText={(t) => setWalletForm((s: any) => ({ ...s, reference: t }))}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      )}

      <KISButton
        title={saving ? 'Working...' : 'Submit'}
        onPress={handleSubmit}
        disabled={submitDisabled}
      />
    </View>
  );
}
