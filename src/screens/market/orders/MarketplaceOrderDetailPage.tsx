import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import DocumentPicker, {
  type DocumentPickerResponse,
} from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { getAccessToken } from '@/security/authStorage';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootStackParamList } from '@/navigation/types';
import {
  backendCentsToFrontendKisc,
  backendOrderTotalToFrontendKisc,
} from '@/utils/currency';

type MarketplaceOrderDetailRoute = RouteProp<
  RootStackParamList,
  'MarketplaceOrderDetail'
>;
type MarketplaceOrderDetailNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'MarketplaceOrderDetail'
>;

const receiptFilePath = (orderId: string) =>
  `${RNFS.DocumentDirectoryPath}/marketplace-order-${orderId}.pdf`;

export default function MarketplaceOrderDetailPage() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<MarketplaceOrderDetailNavigation>();
  const route = useRoute<MarketplaceOrderDetailRoute>();
  const { orderId, mode } = route.params;

  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [complaintText, setComplaintText] = useState('');
  const [complaintAttachment, setComplaintAttachment] =
    useState<DocumentPickerResponse | null>(null);
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getRequest(
        ROUTES.commerce.marketplaceOrder(orderId),
        {
          errorMessage: 'Unable to load order.',
        },
      );
      if (!response.success) {
        throw new Error(response.message || 'Unable to load order.');
      }
      setOrder(response.data);
    } catch (err: any) {
      setError(err?.message || 'Unable to load order.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  const handleAction = useCallback(
    async (endpoint: string, label: string) => {
      if (!order?.id) return;
      setActionLoading(label);
      try {
        const response = await postRequest(endpoint, undefined, {
          errorMessage: label,
        });
        if (!response.success) {
          throw new Error(response.message || label);
        }
        Alert.alert('Order updated', response.message || `${label} succeeded.`);
        await fetchOrder();
      } catch (err: any) {
        Alert.alert(label, err?.message || `${label} failed.`);
      } finally {
        setActionLoading(null);
      }
    },
    [order, fetchOrder],
  );

  const downloadReceipt = useCallback(async () => {
    if (!order?.id) return;
    setReceiptLoading(true);
    try {
      const token = await getAccessToken();
      const deviceId = await AsyncStorage.getItem('device_id');
      const toFile = receiptFilePath(order.id);
      const headers: Record<string, string> = { Accept: '*/*' };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (deviceId) headers['X-Device-Id'] = deviceId;
      const download = RNFS.downloadFile({
        fromUrl: ROUTES.commerce.marketplaceOrderReceipt(order.id),
        toFile,
        headers,
      });
      const result = await download.promise;
      if (result.statusCode && result.statusCode >= 400) {
        throw new Error('Unable to download receipt.');
      }
      const uri = Platform.OS === 'android' ? `file://${toFile}` : toFile;
      await Linking.openURL(uri);
    } catch (err: any) {
      Alert.alert('Receipt', err?.message || 'Unable to download receipt.');
    } finally {
      setReceiptLoading(false);
    }
  }, [order]);

  const handlePickAttachment = useCallback(async () => {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [
          DocumentPicker.types.images,
          DocumentPicker.types.pdf,
          DocumentPicker.types.plainText,
        ],
      });
      setComplaintAttachment(result);
    } catch (err) {
      if (DocumentPicker.isCancel(err)) return;
      Alert.alert('Attachment', 'Unable to pick attachment.');
    }
  }, []);

  const submitComplaint = useCallback(async () => {
    if (!order?.id) return;
    if (!complaintText.trim()) {
      Alert.alert(
        'Complaint',
        'Provide a short statement describing the issue.',
      );
      return;
    }
    setComplaintSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('order_id', order.id);
      formData.append('text', complaintText.trim());
      if (complaintAttachment) {
        formData.append('attachment', {
          uri: complaintAttachment.fileCopyUri || complaintAttachment.uri,
          type: complaintAttachment.type || 'application/octet-stream',
          name: complaintAttachment.name || `attachment-${Date.now()}`,
        } as any);
      }
      const response = await postRequest(
        ROUTES.commerce.marketplaceComplaints,
        formData,
        {
          errorMessage: 'Unable to submit complaint.',
        },
      );
      if (!response.success) {
        throw new Error(response.message || 'Unable to submit complaint.');
      }
      Alert.alert('Complaint submitted', 'Our team will review this shortly.');
      setComplaintText('');
      setComplaintAttachment(null);
    } catch (err: any) {
      Alert.alert(
        'Complaint failed',
        err?.message || 'Unable to submit complaint.',
      );
    } finally {
      setComplaintSubmitting(false);
    }
  }, [order, complaintText, complaintAttachment]);

  const items = useMemo(() => (order?.items ?? []) as Array<any>, [order]);
  const orderTotalKisc = useMemo(
    () => backendOrderTotalToFrontendKisc(order?.total_amount),
    [order?.total_amount],
  );
  const statusLabel = useMemo(() => {
    if (!order?.status) return 'Unknown';
    return order.status.charAt(0).toUpperCase() + order.status.slice(1);
  }, [order]);

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.primaryStrong} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.root, { backgroundColor: palette.bg, padding: 16 }]}>
        <Text style={{ color: palette.text }}>{error}</Text>
      </View>
    );
  }

  if (!order) {
    return null;
  }

  const isAwaitingSatisfaction = order.status === 'awaiting_satisfaction';
  const canCancel = mode === 'buyer' && order.status === 'temporal';
  const canSatisfy =
    mode === 'buyer' && (order.status === 'temporal' || isAwaitingSatisfaction);
  const canComplete = mode === 'provider' && order.status === 'temporal';

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View
        style={[
          styles.header,
          { borderColor: palette.divider, backgroundColor: palette.surface },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <KISIcon name="arrow-left" size={18} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>
          Order details
        </Text>
      </View>
      <View
        style={[
          styles.detailCard,
          { borderColor: palette.divider, backgroundColor: palette.surface },
        ]}
      >
        <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
          Shop
        </Text>
        <Text style={[styles.sectionValue, { color: palette.text }]}>
          {order.shop_info?.name ??
            (typeof order.shop === 'string' ? order.shop : order.shop?.name) ??
            'Shop'}
        </Text>
        <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
          Status
        </Text>
        <Text style={[styles.statusText, { color: palette.primaryStrong }]}>
          {statusLabel}
        </Text>
        <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
          Total
        </Text>
        <Text style={[styles.sectionValue, { color: palette.primaryStrong }]}>
          {orderTotalKisc.toFixed(2)} {order.currency ?? 'KISC'}
        </Text>
      </View>
      {isAwaitingSatisfaction ? (
        <View
          style={[styles.awaitingBanner, { borderColor: palette.primaryLight }]}
        >
          <Text
            style={[
              styles.awaitingBannerText,
              { color: palette.primaryStrong },
            ]}
          >
            Provider marked this order complete. Confirm satisfaction within 3
            days or open a complaint.
          </Text>
        </View>
      ) : null}
      <View style={styles.itemsSection}>
        {items.map(item => {
          const attrs = item.selected_attributes || {};
          return (
            <View
              key={item.id}
              style={[
                styles.itemCard,
                {
                  borderColor: palette.divider,
                  backgroundColor: palette.surface,
                },
              ]}
            >
              <View style={styles.itemRow}>
                <Text
                  style={[styles.itemName, { color: palette.text }]}
                  numberOfLines={2}
                >
                  {item.product_name || item.product_id}
                </Text>
                <Text
                  style={[styles.itemPrice, { color: palette.primaryStrong }]}
                >
                  {backendCentsToFrontendKisc(item.unit_price_cents).toFixed(2)}{' '}
                  {order.currency}
                </Text>
              </View>
              <Text style={[styles.itemMeta, { color: palette.subtext }]}>
                Qty: {item.quantity} · Line total:{' '}
                {(
                  backendCentsToFrontendKisc(item.unit_price_cents) *
                  Number(item.quantity ?? 0)
                ).toFixed(2)}{' '}
                {order.currency ?? 'KISC'}
              </Text>
              {item.custom_description ? (
                <Text style={[styles.itemMeta, { color: palette.text }]}>
                  {item.custom_description}
                </Text>
              ) : null}
              {Object.entries(attrs).map(([key, values]) =>
                Array.isArray(values) ? (
                  <View key={key} style={styles.attributeRow}>
                    <Text
                      style={[
                        styles.attributeLabel,
                        { color: palette.subtext },
                      ]}
                    >
                      {key}:
                    </Text>
                    <View style={styles.attributeChips}>
                      {(values as string[]).map(value => (
                        <View
                          key={value}
                          style={[
                            styles.attributeChip,
                            { borderColor: palette.divider },
                          ]}
                        >
                          <Text style={{ color: palette.text }}>{value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null,
              )}
            </View>
          );
        })}
      </View>
      <View
        style={[
          styles.actionsSection,
          { borderColor: palette.divider, backgroundColor: palette.surface },
        ]}
      >
        <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
          Actions
        </Text>
        <View style={styles.actionRow}>
          {canCancel ? (
            <KISButton
              title={
                actionLoading === 'cancel' ? 'Cancelling…' : 'Cancel order'
              }
              size="sm"
              variant="outline"
              onPress={() =>
                handleAction(
                  ROUTES.commerce.marketplaceOrderCancel(order.id),
                  'Unable to cancel order',
                )
              }
              loading={actionLoading === 'cancel'}
            />
          ) : null}
          {canSatisfy ? (
            <KISButton
              title={
                actionLoading === 'satisfy' ? 'Confirming…' : 'Mark satisfied'
              }
              size="sm"
              variant="secondary"
              onPress={() =>
                handleAction(
                  ROUTES.commerce.marketplaceOrderSatisfy(order.id),
                  'Unable to mark satisfied',
                )
              }
              loading={actionLoading === 'satisfy'}
            />
          ) : null}
          {canComplete ? (
            <KISButton
              title={
                actionLoading === 'complete' ? 'Completing…' : 'Mark completed'
              }
              size="sm"
              variant="secondary"
              onPress={() =>
                handleAction(
                  ROUTES.commerce.marketplaceOrderComplete(order.id),
                  'Unable to mark completed',
                )
              }
              loading={actionLoading === 'complete'}
            />
          ) : null}
        </View>
        <KISButton
          title={receiptLoading ? 'Downloading…' : 'Download receipt'}
          size="sm"
          variant="ghost"
          onPress={downloadReceipt}
          loading={receiptLoading}
        />
      </View>
      <View
        style={[
          styles.complaintSection,
          { borderColor: palette.divider, backgroundColor: palette.surface },
        ]}
      >
        <Text style={[styles.sectionLabel, { color: palette.subtext }]}>
          File a complaint
        </Text>
        <TextInput
          style={[
            styles.complaintInput,
            { borderColor: palette.divider, color: palette.text },
          ]}
          placeholder="What went wrong?"
          placeholderTextColor={palette.subtext}
          value={complaintText}
          onChangeText={setComplaintText}
          multiline
          numberOfLines={3}
        />
        <Pressable
          onPress={handlePickAttachment}
          style={styles.attachmentButton}
        >
          <KISIcon name="paperclip" size={16} color={palette.text} />
          <Text style={{ color: palette.text, marginLeft: 8 }}>
            {complaintAttachment
              ? complaintAttachment.name
              : 'Add attachment (optional)'}
          </Text>
        </Pressable>
        <KISButton
          title={complaintSubmitting ? 'Submitting…' : 'Submit complaint'}
          size="sm"
          onPress={submitComplaint}
          loading={complaintSubmitting}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  detailCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    margin: 16,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  sectionValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemsSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '800',
  },
  itemMeta: {
    fontSize: 12,
  },
  attributeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  attributeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  attributeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  attributeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  actionsSection: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    margin: 16,
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  awaitingBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  awaitingBannerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  complaintSection: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 32,
    gap: 12,
  },
  complaintInput: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    minHeight: 80,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
