// src/screens/broadcast/education/components/EducationEnrollmentSheet.tsx
import React from 'react';
import { Linking, Modal, ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import type { EducationContentItem, EducationPricing } from '@/screens/broadcast/education/api/education.models';

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

  if (!content) return null;

  const pricing = 'price' in content ? content.price : undefined;
  const priceLabel = formatPrice(pricing);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: palette.backdrop }}>
        <View
          style={{
            marginTop: '30%',
            backgroundColor: palette.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 24,
            flex: 1,
          }}
        >
          <ScrollView>
            <Text style={{ color: palette.subtext, marginBottom: 4 }}>Enroll now</Text>
            <Text style={{ color: palette.text, fontWeight: '800', fontSize: 20 }}>{content.title}</Text>
            <Text style={{ color: palette.primaryStrong, marginTop: 6, fontWeight: '700' }}>{priceLabel}</Text>
            <Text style={{ color: palette.subtext, marginTop: 12 }}>
              {content.partnerName ?? 'Creator'} · {content.level ?? 'All levels'}
            </Text>
            <Text style={{ marginTop: 12, color: palette.subtext }}>{content.summary}</Text>
            <View style={{ marginTop: 18, flexDirection: 'row', gap: 12 }}>
              {pricing?.isFree ? (
                <KISButton title="Free enroll" onPress={() => onFreeEnroll(content)} />
              ) : (
                <KISButton title="Checkout" onPress={() => onCheckout(content)} />
              )}
              <KISButton title="Close" variant="secondary" onPress={onClose} />
            </View>
            {paymentState === 'processing' ? (
              <Text style={{ color: palette.primary, marginTop: 14 }}>Processing payment…</Text>
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
        </View>
      </View>
    </Modal>
  );
}
