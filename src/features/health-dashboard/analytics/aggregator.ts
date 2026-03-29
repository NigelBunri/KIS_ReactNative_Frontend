import type { AnalyticsHeader, ServiceAnalyticsBundle, UsageRow } from '@/features/health-dashboard/models';
import type { AnalyticsQueryPayload, AnalyticsTimeRange, PaymentRecord } from './types';

const PAYMENT_METHODS = ['cash', 'insurance', 'online'] as const;

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toPercent = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const normalizeMethod = (value: string | undefined): (typeof PAYMENT_METHODS)[number] => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('insur')) return 'insurance';
  if (normalized.includes('online') || normalized.includes('card') || normalized.includes('bank')) return 'online';
  return 'cash';
};

const normalizeDate = (value?: string): string => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toISOString().slice(0, 10);
};

const inRange = (rawDate: string | undefined, range: AnalyticsTimeRange): boolean => {
  if (range === 'all') return true;
  const date = rawDate ? new Date(rawDate) : null;
  if (!date || Number.isNaN(date.getTime())) return false;
  const now = Date.now();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const threshold = now - days * 24 * 60 * 60 * 1000;
  return date.getTime() >= threshold;
};

const amountCents = (payment: PaymentRecord): number => {
  const cents = toNumber(payment.amount_cents, NaN);
  if (Number.isFinite(cents)) return cents;
  return Math.round(toNumber(payment.amount, 0) * 100);
};

const toTopRows = (source: Map<string, number>, prefix: string): UsageRow[] => {
  return Array.from(source.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value], idx) => ({
      id: `${prefix}-${idx + 1}`,
      label,
      value,
    }));
};

export const aggregateInstitutionAnalytics = (
  payload: AnalyticsQueryPayload,
  timeRange: AnalyticsTimeRange = '30d',
): {
  analyticsHeader: AnalyticsHeader;
  analytics: ServiceAnalyticsBundle;
} => {
  const bookings = payload.bookings.filter((item) => inRange(item.booked_at ?? item.created_at ?? item.date, timeRange));
  const consultations = payload.consultations.filter((item) => inRange(item.completed_at ?? item.started_at, timeRange));
  const schedules = payload.schedules.filter((item) => inRange(item.starts_at ?? item.date, timeRange));
  const payments = payload.payments.filter((item) => inRange(item.paid_at ?? item.created_at ?? item.date, timeRange));
  const ratings = payload.ratings.filter((item) => inRange(item.created_at, timeRange));

  const completedConsultations = consultations.filter((item) =>
    ['done', 'completed', 'closed', 'finished'].includes((item.status ?? '').toLowerCase()),
  ).length;

  const pendingSchedules = schedules.filter((item) =>
    ['pending', 'scheduled', 'upcoming', 'queued'].includes((item.status ?? '').toLowerCase()),
  ).length;

  const cancelledBookings = bookings.filter((item) =>
    ['cancelled', 'canceled', 'rejected', 'void'].includes((item.status ?? '').toLowerCase()),
  ).length;

  const conversionViews = toNumber(payload.traffic.views, 0);
  const conversionRate = conversionViews > 0 ? (bookings.length / conversionViews) * 100 : 0;
  const cancellationRate = bookings.length > 0 ? (cancelledBookings / bookings.length) * 100 : 0;

  const averageRating =
    ratings.length > 0
      ? ratings.reduce((sum, rating) => sum + toNumber(rating.rating ?? rating.score, 0), 0) / ratings.length
      : 0;

  const patientVisitCount = new Map<string, number>();
  bookings.forEach((booking) => {
    const key = booking.patient_id ?? booking.patient_name ?? '';
    if (!key) return;
    patientVisitCount.set(key, (patientVisitCount.get(key) ?? 0) + 1);
  });
  const uniquePatients = patientVisitCount.size;
  const returningPatients = Array.from(patientVisitCount.values()).filter((count) => count > 1).length;
  const patientReturnRate = uniquePatients > 0 ? (returningPatients / uniquePatients) * 100 : 0;

  const paymentByMethod = new Map<string, number>();
  payments.forEach((payment) => {
    const method = normalizeMethod(payment.method ?? payment.payment_method);
    const amount = amountCents(payment);
    if (amount <= 0) return;
    paymentByMethod.set(method, (paymentByMethod.get(method) ?? 0) + amount);
  });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let todayRevenue = 0;
  let weekRevenue = 0;
  let monthRevenue = 0;
  payments.forEach((payment) => {
    const dateSource = payment.paid_at ?? payment.created_at ?? payment.date;
    if (!dateSource) return;
    const date = new Date(dateSource);
    if (Number.isNaN(date.getTime())) return;
    const amount = amountCents(payment);
    if (amount <= 0) return;
    if (normalizeDate(dateSource) === today) todayRevenue += amount;
    if (date.getTime() >= startOfWeek.getTime()) weekRevenue += amount;
    if (date.getFullYear() === currentYear && date.getMonth() === currentMonth) monthRevenue += amount;
  });

  const bookingsByDate = new Map<string, number>();
  bookings.forEach((booking) => {
    const day = normalizeDate(booking.booked_at ?? booking.created_at ?? booking.date);
    bookingsByDate.set(day, (bookingsByDate.get(day) ?? 0) + 1);
  });

  const serviceUsage = new Map<string, number>();
  bookings.forEach((booking) => {
    const key = booking.service_name ?? booking.service_id ?? 'Unknown service';
    serviceUsage.set(key, (serviceUsage.get(key) ?? 0) + 1);
  });

  const paymentRows = Array.from(paymentByMethod.entries()).map(([label, value], index) => ({
    id: `payment-${index + 1}`,
    label,
    value,
  }));

  return {
    analyticsHeader: {
      revenue: {
        today: todayRevenue,
        week: weekRevenue,
        month: monthRevenue,
      },
      bookingsCount: bookings.length,
      completedConsultations,
      pendingSchedules,
      cancellationRate: toPercent(cancellationRate),
      conversion: {
        views: conversionViews,
        bookings: bookings.length,
        rate: toPercent(conversionRate),
      },
      averageRating: toPercent(averageRating),
      patientReturnRate: toPercent(patientReturnRate),
      paymentBreakdown: {
        cash: paymentByMethod.get('cash') ?? 0,
        insurance: paymentByMethod.get('insurance') ?? 0,
        online: paymentByMethod.get('online') ?? 0,
      },
    },
    analytics: {
      bookingsOverTime: Array.from(bookingsByDate.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, value]) => ({ label, value })),
      revenueBreakdown: PAYMENT_METHODS.map((method) => ({
        label: method,
        value: paymentByMethod.get(method) ?? 0,
      })),
      serviceUsageDistribution: Array.from(serviceUsage.entries()).map(([label, value]) => ({
        label,
        value,
      })),
      topServices: toTopRows(serviceUsage, 'service'),
      topPatients: toTopRows(patientVisitCount, 'patient'),
      paymentMethodBreakdown: paymentRows,
    },
  };
};
