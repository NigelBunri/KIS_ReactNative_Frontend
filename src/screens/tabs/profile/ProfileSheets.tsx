import React from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import usePullDownToClose from '@/hooks/usePullDownToClose';
import { styles } from './profile.styles';
import type { ItemType } from './profile.types';
import {
  EditItemModal,
  EditProfileModal,
  PrivacyModal,
  UpgradeModal,
  WalletModal,
  getSheetTitle,
} from '../profile-screen';

type Props = {
  palette: any;
  activeSheet: string | null;
  sheetY: Animated.Value;
  closeSheet: () => void;

  draftProfile: any;
  setDraftProfile: (fn: any) => void;
  pickImage: (kind: 'avatar' | 'cover') => Promise<void>;
  saveProfile: () => void;

  draftPrivacy: Record<string, any>;
  setDraftPrivacy: (fn: any) => void;
  savePrivacy: () => void;

  draftItem: any;
  setDraftItem: (fn: any) => void;
  pickShowcaseFile: (type: ItemType) => Promise<any>;
  saveItem: () => void;

  profile: any;
  saving: boolean;

  walletForm: any;
  setWalletForm: (fn: any) => void;
  submitWalletAction?: () => Promise<void>;
  lastWalletPaymentUrl?: string;

  upgradeTier: (tierId: string) => void;
  billingHistory?: any;
  subscription?: any;
  cancelSubscription: (immediate?: boolean) => void;
  resumeSubscription: () => void;
  downgradeTier: (tierId: string) => void;
  retryTransaction: (txRef: string) => void;
  tiers?: any[];
};

export default function ProfileSheets(props: Props) {
  const {
    palette,
    activeSheet,
    sheetY,
    closeSheet,

    draftProfile,
    setDraftProfile,
    pickImage,
    saveProfile,

    draftPrivacy,
    setDraftPrivacy,
    savePrivacy,

    draftItem,
    setDraftItem,
    pickShowcaseFile,
    saveItem,

    profile,
    saving,

    walletForm,
    setWalletForm,
    submitWalletAction,
    lastWalletPaymentUrl,

    upgradeTier,
    billingHistory,
    subscription,
    tiers = [],
    cancelSubscription,
    resumeSubscription,
    downgradeTier,
    retryTransaction,
  } = props;

  const { dragY, panHandlers } = usePullDownToClose({
    enabled: Boolean(activeSheet),
    onClose: closeSheet,
  });

  if (!activeSheet) return null;

  const accountTier = profile?.account?.tier;
  const sheetTitle = getSheetTitle(activeSheet);

  return (
    <Animated.View
      style={[
        styles.sheetWrap,
        { transform: [{ translateY: Animated.add(sheetY, dragY) }] },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.sheet, { backgroundColor: palette.bg }]}
      >
        <View style={styles.sheetHeader} {...panHandlers}>
          <Text style={[styles.sheetTitle, { color: palette.text }]}>
            {sheetTitle}
          </Text>
          <Pressable onPress={closeSheet}>
            <KISIcon name="close" size={22} color={palette.subtext} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {activeSheet === 'editProfile' && (
            <EditProfileModal
              palette={palette}
              draftProfile={draftProfile}
              setDraftProfile={setDraftProfile}
              pickImage={pickImage}
              saving={saving}
              saveProfile={saveProfile}
            />
          )}

          {activeSheet === 'privacy' && (
            <PrivacyModal
              palette={palette}
              draftPrivacy={draftPrivacy}
              setDraftPrivacy={setDraftPrivacy}
              saving={saving}
              savePrivacy={savePrivacy}
              profile={profile}
            />
          )}

          {activeSheet === 'editItem' && draftItem && (
            <EditItemModal
              palette={palette}
              draftItem={draftItem}
              setDraftItem={setDraftItem}
              pickShowcaseFile={pickShowcaseFile}
              saving={saving}
              saveItem={saveItem}
            />
          )}

          {activeSheet === 'wallet' && (
            <WalletModal
              palette={palette}
              walletForm={walletForm}
              setWalletForm={setWalletForm}
              saving={saving}
              submitWalletAction={submitWalletAction}
              lastWalletPaymentUrl={lastWalletPaymentUrl}
            />
          )}

          {activeSheet === 'upgrade' && (
            <UpgradeModal
              tiers={tiers.length ? tiers : profile?.tiers || []}
              accountTier={accountTier}
              saving={saving}
              onUpgrade={upgradeTier}
              subscription={subscription ?? profile?.subscription}
              billingHistory={billingHistory}
              usage={billingHistory?.usage || profile?.stats}
              onCancel={cancelSubscription}
              onResume={resumeSubscription}
              onDowngrade={downgradeTier}
              onRetry={retryTransaction}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
