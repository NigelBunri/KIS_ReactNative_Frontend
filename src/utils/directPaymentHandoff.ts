import { Linking } from 'react-native';

export type DirectPaymentInfo = {
  intentId: string;
  reference: string;
  paymentUrl: string;
  status: string;
  provider: string;
};

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

const readObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const normalizePaymentStatus = (value: unknown): string =>
  readString(value || 'pending').toLowerCase().replace(/\s+/g, '_');

export const paymentStatusLabel = (status: string): string => {
  const normalized = normalizePaymentStatus(status);
  if (normalized === 'paid' || normalized === 'success' || normalized === 'successful') return 'Paid';
  if (normalized === 'satisfied') return 'Satisfied';
  if (normalized === 'failed') return 'Failed';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
  if (normalized === 'refunded') return 'Refunded';
  if (normalized === 'not_required') return 'Not required';
  return 'Pending provider payment';
};

export const isProviderPaymentPending = (status: string): boolean => {
  const normalized = normalizePaymentStatus(status);
  return ['pending', 'payment_pending', 'waiting', 'quote_ready'].includes(normalized);
};

export const isProviderPaymentFailed = (status: string): boolean => {
  const normalized = normalizePaymentStatus(status);
  return ['failed', 'cancelled', 'canceled'].includes(normalized);
};

export const getDirectPaymentInfo = (...sources: unknown[]): DirectPaymentInfo => {
  const info: DirectPaymentInfo = {
    intentId: '',
    reference: '',
    paymentUrl: '',
    status: 'pending',
    provider: 'flutterwave',
  };
  for (const source of sources) {
    const row = readObject(source);
    const metadata = readObject(row.metadata);
    const payload = readObject(row.payload);
    info.intentId ||= readString(
      row.direct_payment_intent_id ||
        row.directPaymentIntentId ||
        row.payment_intent_id ||
        row.paymentIntentId ||
        metadata.direct_payment_intent_id ||
        metadata.directPaymentIntentId ||
        payload.direct_payment_intent_id,
    );
    info.reference ||= readString(
      row.payment_reference ||
        row.paymentReference ||
        row.transaction_reference ||
        row.transactionReference ||
        row.payment_tx_ref ||
        row.tx_ref ||
        metadata.payment_reference ||
        payload.payment_reference,
    );
    info.paymentUrl ||= readString(
      row.payment_url || row.paymentUrl || metadata.payment_url || metadata.paymentUrl || payload.payment_url,
    );
    const explicitStatus = readString(
      row.payment_status || row.paymentStatus || metadata.payment_status || payload.payment_status,
    );
    const fallbackStatus = readString(row.status);
    if (explicitStatus) {
      info.status = normalizePaymentStatus(explicitStatus);
    } else if (!info.status || info.status === 'pending') {
      info.status = normalizePaymentStatus(fallbackStatus || info.status);
    }
    const provider = readString(
      row.payment_provider || row.paymentProvider || row.payment_method || metadata.payment_provider || payload.payment_provider,
    );
    if (provider) info.provider = provider;
  }
  return info;
};

export const openDirectPaymentUrl = async (paymentUrl: string): Promise<boolean> => {
  const url = readString(paymentUrl);
  if (!url) return false;
  const supported = await Linking.canOpenURL(url);
  if (!supported) return false;
  await Linking.openURL(url);
  return true;
};
