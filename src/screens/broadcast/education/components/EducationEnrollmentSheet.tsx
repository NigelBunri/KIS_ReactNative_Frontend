// src/screens/broadcast/education/components/EducationEnrollmentSheet.tsx
import React from 'react';
import { Animated, Linking, Modal, ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import usePullDownToClose from '@/hooks/usePullDownToClose';
import type {
  EducationContentItem,
  EducationPricing,
} from '@/screens/broadcast/education/api/education.models';

type Props = {
  visible: boolean;
  content: EducationContentItem | null;
  onClose: () => void;
  onFreeEnroll: (content: EducationContentItem) => void;
  onCheckout: (content: EducationContentItem) => void;
  paymentState: 'idle' | 'processing' | 'success' | 'error';
  receiptUrl?: string | null;
};

const formatPrice = (price?: EducationPricing) => {
  if (!price) return 'Pricing TBD';
  if (price.isFree) return 'Free';
  return `${price.currency ?? 'USD'} ${(price.amountCents ?? 0) / 100}`;
};

export default function EducationEnrollmentSheet({
  visible,
  content,
  onClose,
  onFreeEnroll,
  onCheckout,
  paymentState,
  receiptUrl,
}: Props) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compactSheet = responsive.isWatch || responsive.isCompactPhone;
  const { dragY, panHandlers } = usePullDownToClose({
    enabled: visible,
    onClose,
  });

  if (!content) return null;

  const pricing = 'price' in content ? content.price : undefined;
  const priceLabel = formatPrice(pricing);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: palette.backdrop }}>
        <Animated.View
          style={{
            marginTop: '30%',
            backgroundColor: palette.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: compactSheet ? 14 : responsive.pageGutter,
            maxWidth: responsive.isTablet ? 760 : undefined,
            alignSelf: responsive.isTablet ? 'center' : 'stretch',
            width: responsive.isTablet ? '92%' : '100%',
            flex: 1,
            transform: [{ translateY: dragY }],
          }}
        >
          <View
            {...panHandlers}
            style={{ alignItems: 'center', paddingBottom: 14 }}
          >
            <View
              style={{
                width: 44,
                height: 5,
                borderRadius: 999,
                backgroundColor: palette.divider,
              }}
            />
          </View>
          <ScrollView>
            <Text style={{ color: palette.subtext, marginBottom: 4 }}>
              Ready to join?
            </Text>
            <Text
              style={{ color: palette.text, fontWeight: '800', fontSize: 20 }}
            >
              {content.title}
            </Text>
            <Text
              style={{
                color: palette.primaryStrong,
                marginTop: 6,
                fontWeight: '700',
              }}
            >
              {priceLabel}
            </Text>
            <Text style={{ color: palette.subtext, marginTop: 12 }}>
              {content.partnerName ?? 'Creator'} ·{' '}
              {content.level ?? 'All levels'}
            </Text>
            <Text style={{ marginTop: 12, color: palette.subtext }}>
              {content.summary}
            </Text>
            <View style={{ marginTop: 18, flexDirection: compactSheet ? 'column' : 'row', gap: 12 }}>
              {pricing?.isFree ? (
                <KISButton
                  title="Join for free"
                  onPress={() => onFreeEnroll(content)}
                />
              ) : (
                <KISButton
                  title="Book my spot"
                  onPress={() => onCheckout(content)}
                />
              )}
              <KISButton title="Not now" variant="secondary" onPress={onClose} />
            </View>
            {paymentState === 'processing' ? (
              <Text style={{ color: palette.primary, marginTop: 14 }}>
                Processing payment…
              </Text>
            ) : null}
            {paymentState === 'success' && receiptUrl ? (
              <Text
                style={{ color: palette.primaryStrong, marginTop: 14 }}
                onPress={() => {
                  Linking.openURL(receiptUrl);
                }}
              >
                View receipt
              </Text>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
