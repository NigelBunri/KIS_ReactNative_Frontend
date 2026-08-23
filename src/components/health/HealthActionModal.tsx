import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { KISIcon } from '@/constants/kisIcons';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { HealthThemeColors, HEALTH_THEME_TYPOGRAPHY } from '@/theme/health';

type HealthActionModalProps = {
  palette: HealthThemeColors;
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/**
 * Shared full-screen action-modal shell (Modal -> LinearGradient ->
 * SafeAreaView -> header -> scrollable body -> optional footer). CCC
 * previously duplicated this shell near-verbatim across four modals
 * (task/escalation/triage/referral); each now supplies only its distinct
 * body content and footer actions.
 */
export default function HealthActionModal({ palette, visible, title, onClose, children, footer }: HealthActionModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, paddingTop: 40 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingBottom: 16,
            }}
          >
            <Text
              style={{
                color: palette.text,
                fontSize: HEALTH_THEME_TYPOGRAPHY.h2.fontSize,
                fontWeight: HEALTH_THEME_TYPOGRAPHY.h2.fontWeight,
                flex: 1,
              }}
            >
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <KISIcon name="close" size={22} color={palette.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>{children}</ScrollView>
          {footer ? <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>{footer}</View> : null}
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}
