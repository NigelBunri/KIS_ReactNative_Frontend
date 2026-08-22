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
  onRequestAccess?: (content: EducationContentItem) => void;
  requestingAccess?: boolean;
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
  onRequestAccess,
  requestingAccess,
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
  // viewer_state is attached loosely (not in the shared type) by the
  // discovery/detail response mapper — see EducationV2DiscoverPage.tsx's
  // existing defensive snake_case/camelCase reads of the same object.
  const viewerState = (content as any)?.viewerState || {};
  const isPrivate = viewerState?.visibility === 'private';
  const accessRequestStatus =
    viewerState?.access_request_status ?? viewerState?.accessRequestStatus ?? null;
  const canRequestAccess = Boolean(
    viewerState?.can_request_access ?? viewerState?.canRequestAccess,
  );
  const accessApproved = accessRequestStatus === 'approved' || !isPrivate;

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
            {!pricing?.isFree && !(isPrivate && !accessApproved) ? (
              <Text style={{ color: palette.subtext, marginTop: 10, fontSize: 12 }}>
                You'll be charged {priceLabel} through a secure checkout. You
                can review the total before anything is charged.
              </Text>
            ) : null}
            {isPrivate && !accessApproved ? (
              <Text style={{ color: palette.subtext, marginTop: 10 }}>
                {accessRequestStatus === 'pending'
                  ? 'Your access request is pending institution approval.'
                  : accessRequestStatus === 'rejected'
                  ? 'Your access request for this course was denied.'
                  : 'This is a private course. Request access to view or purchase it.'}
              </Text>
            ) : null}
            <View style={{ marginTop: 18, flexDirection: compactSheet ? 'column' : 'row', gap: 12 }}>
              {isPrivate && !accessApproved ? (
                canRequestAccess && onRequestAccess ? (
                  <KISButton
                    title={requestingAccess ? 'Requesting…' : 'Request access'}
                    onPress={() => onRequestAccess(content)}
                    disabled={requestingAccess}
                    loading={requestingAccess}
                  />
                ) : null
              ) : pricing?.isFree ? (
                <KISButton
                  title="Join for free"
                  onPress={() => onFreeEnroll(content)}
                  disabled={paymentState === 'processing'}
                  loading={paymentState === 'processing'}
                />
              ) : (
                <KISButton
                  title={
                    paymentState === 'processing'
                      ? 'Processing…'
                      : `Pay ${priceLabel}`
                  }
                  onPress={() => onCheckout(content)}
                  disabled={paymentState === 'processing'}
                  loading={paymentState === 'processing'}
                />
              )}
              <KISButton
                title="Not now"
                variant="secondary"
                onPress={onClose}
                disabled={paymentState === 'processing'}
              />
            </View>
            {paymentState === 'processing' ? (
              <Text style={{ color: palette.primary, marginTop: 14, fontWeight: '600' }}>
                Processing your payment — please don't close the app.
              </Text>
            ) : null}
            {paymentState === 'error' ? (
              <Text style={{ color: palette.danger, marginTop: 14 }}>
                That didn't go through and you were not charged. You can try again above.
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
