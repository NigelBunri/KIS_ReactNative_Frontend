import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuth } from '../../../App';
import ROUTES, { API_BASE_URL } from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import DocumentPicker from 'react-native-document-picker';
import { getUserData } from '@/network/cache';
import { backendCentsToFrontendKisc, formatKiscAmount } from '@/utils/currency';
import {
  createDefaultAvailability,
  formatDateKey,
  getDayKey,
  normalizeAvailabilityPayload,
  ServiceAvailability,
} from './availabilityUtils';

const formatKisc = (value: number | null | undefined) => {
  return formatKiscAmount(backendCentsToFrontendKisc(value));
};

const formatDurationLabel = (ms: number) => {
  if (ms <= 0) return '0m';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return parts.length ? parts.join(' ') : '<1m';
};

const formatTimestamp = (value?: string | number | null) => {
  if (value === undefined || value === null) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const MANAGEABLE_ROLES = new Set(['owner', 'manager', 'admin']);

const getServiceIdentifier = (booking?: any): string | null => {
  if (!booking) return null;
  return (
    booking?.service_details?.id ||
    booking?.service_id ||
    booking?.service?.id ||
    booking?.service ||
    booking?.service_uuid ||
    null
  );
};

const getShopIdentifier = (booking?: any): string | null => {
  if (!booking) return null;
  return (
    booking?.service_details?.shop_id ||
    booking?.service?.shop_id ||
    booking?.service?.shop ||
    booking?.shop_id ||
    booking?.shop?.id ||
    booking?.shop||
    booking?.shop?.shop_id ||
    booking?.provider_details?.shop_id ||
    booking?.provider_details?.shop?.id ||
    booking?.provider_details?.shop ||
    null
  );
};

const getBookingCustomer = (booking?: any) => {
  const userShape = booking?.user_details ?? booking?.payer_details ?? booking?.customer ?? booking?.user ?? {};
  const displayName =
    userShape?.display_name ||
    userShape?.name ||
    userShape?.full_name ||
    booking?.user_name ||
    booking?.payer_name ||
    'Customer';
  const phone =
    userShape?.phone ||
    userShape?.phone_number ||
    userShape?.contact ||
    booking?.user_phone ||
    booking?.payer_phone ||
    booking?.phone ||
    null;
  const email =
    userShape?.email || userShape?.email_address || booking?.user_email || booking?.payer_email || null;
  return { name: displayName, phone, email };
};

const CANCELLED_STATUSES = new Set(['cancelled', 'canceled', 'rejected', 'void']);

const getBookingUserId = (booking?: any): string | null => {
  if (!booking) return null;
  if (booking?.user && typeof booking.user !== 'object') {
    return String(booking.user);
  }
  const userShape = booking?.user_details ?? booking?.payer_details ?? booking?.customer ?? booking?.user ?? {};
  return (
    userShape?.id ??
    userShape?.user_id ??
    userShape?.uuid ??
    userShape?.owner_id ??
    userShape?.provider_id ??
    null
  );
};

const isBookingCancelled = (booking?: any) => {
  const status = String(booking?.status ?? '').toLowerCase();
  return CANCELLED_STATUSES.has(status);
};

const DEFAULT_CANCELLATION_WINDOW_MS = 2 * 60 * 60 * 1000;
const DEFAULT_RESCHEDULE_WINDOW_MS = 0;
const TIME_SLOT_START_HOUR = 8;
const TIME_SLOT_END_HOUR = 20;
const TIME_SLOT_STEP_MINUTES = 30;
const DEFAULT_DATE_WINDOW = 21;
const MAX_RANGE_OPTIONS = 366;

const generateTimeline = (slotDurationMinutes: number) => {
  const duration = Math.max(5, slotDurationMinutes || TIME_SLOT_STEP_MINUTES);
  const steps = Math.floor(((TIME_SLOT_END_HOUR - TIME_SLOT_START_HOUR) * 60) / duration);
  const slots: string[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const totalMinutes = TIME_SLOT_START_HOUR * 60 + index * duration;
    if (totalMinutes > TIME_SLOT_END_HOUR * 60) break;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }
  return slots;
};

const normalizeDateKey = (value: Date | string) => {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

const parseDateOnly = (value?: string | null) => {
  if (!value) return null;
  const parts = value.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((segment) => !Number.isFinite(segment))) return null;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatAvailabilityRangeLabel = (range?: ServiceAvailability['date_range']) => {
  if (!range) return '';
  const start = parseDateOnly(range.start_date);
  const end = parseDateOnly(range.end_date);
  if (!start || !end) return '';
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const endLabel = end.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
};

const isDateWithinRange = (date: Date, range?: ServiceAvailability['date_range']) => {
  if (!range) return true;
  const start = parseDateOnly(range.start_date);
  const end = parseDateOnly(range.end_date);
  if (!start || !end) return true;
  const candidate = new Date(date);
  candidate.setHours(0, 0, 0, 0);
  return candidate.getTime() >= start.getTime() && candidate.getTime() <= end.getTime();
};

const getAvailabilityEntry = (date: Date, availability: ServiceAvailability) => {
  const key = formatDateKey(date);
  return availability.specific_dates[key] ?? availability.days[getDayKey(date)];
};

const buildDateOptions = (serviceDetails: any, availability: ServiceAvailability) => {
  const now = new Date();
  const minNoticeHours = Math.max(0, Number(serviceDetails?.min_notice_hours ?? 24));
  const earliest = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
  const maxAdvanceDays = Number(serviceDetails?.max_advance_booking_days ?? 30);
  const windowDays = Math.min(Math.max(maxAdvanceDays > 0 ? maxAdvanceDays : 30, 3), 90);
  const blackoutDates = Array.isArray(serviceDetails?.blackout_dates) ? serviceDetails.blackout_dates : [];
  const blackoutSet = new Set(blackoutDates.map((item: any) => normalizeDateKey(item)));
  const earliestBoundary = new Date(earliest);
  earliestBoundary.setHours(0, 0, 0, 0);
  const latestAllowed = new Date(now);
  if (maxAdvanceDays > 0) {
    latestAllowed.setDate(latestAllowed.getDate() + maxAdvanceDays);
  } else {
    latestAllowed.setDate(latestAllowed.getDate() + windowDays);
  }
  latestAllowed.setHours(23, 59, 59, 999);
  const rangeStart = parseDateOnly(availability.date_range?.start_date);
  const rangeEnd = parseDateOnly(availability.date_range?.end_date);
  const startBoundary = rangeStart && rangeStart.getTime() > earliestBoundary.getTime() ? rangeStart : earliestBoundary;
  const proposedEnd = rangeEnd ? new Date(rangeEnd) : new Date(latestAllowed);
  proposedEnd.setHours(23, 59, 59, 999);
  const endBoundary = new Date(Math.min(proposedEnd.getTime(), latestAllowed.getTime()));
  const maxOptions = availability.date_range ? MAX_RANGE_OPTIONS : DEFAULT_DATE_WINDOW;
  if (endBoundary.getTime() < startBoundary.getTime()) return [];
  const options: Date[] = [];
  const cursor = new Date(startBoundary);
  while (cursor.getTime() <= endBoundary.getTime() && options.length < Math.max(maxOptions, 1)) {
    if (cursor.getTime() > now.getTime() && isDateWithinRange(cursor, availability.date_range)) {
      const key = normalizeDateKey(cursor);
      if (!blackoutSet.has(key)) {
        const specificSlot = availability.specific_dates[key];
        const weeklySlot = availability.days[getDayKey(cursor)];
        const entry = specificSlot || weeklySlot;
        if (entry?.enabled) options.push(new Date(cursor));
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return options;
};

const buildSlotsForDate = (date: Date | null, availability: ServiceAvailability) => {
  if (!date) return [];
  const entry = getAvailabilityEntry(date, availability);
  if (!entry) return [];
  const timeline = generateTimeline(availability.slot_duration_minutes);
  const allowedTimes = entry.all_day ? new Set(timeline) : new Set(entry.times);
  return timeline.map((time) => ({
    time,
    enabled: entry.enabled && (entry.all_day || allowedTimes.has(time)),
  }));
};

const formatSlotLabel = (value: Date) =>
  value.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const ServiceBookingDetailsPage = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'ServiceBookingDetails'>>();
  const bookingId = route.params?.bookingId;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { palette } = useKISTheme();
  const { user } = useAuth();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintData, setComplaintData] = useState({
    personalStatement: '',
    reason: '',
    receiptUrl: '',
  });

  const [cachedStorageUser, setCachedStorageUser] = useState<any | null>();
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { user: storedUser } = await getUserData();
        if (!mounted) return;
        setCachedStorageUser(storedUser);
      } catch {
        console.error("there is an error in getting user data!");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const [shopMembers, setShopMembers] = useState<any[]>([]);
  const [shopMembersError, setShopMembersError] = useState<string | null>(null);
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [serviceRoster, setServiceRoster] = useState<any[]>([]);
  const [serviceRosterLoading, setServiceRosterLoading] = useState(false);
  const [serviceRosterLoaded, setServiceRosterLoaded] = useState(false);
  const [serviceRosterError, setServiceRosterError] = useState<string | null>(null);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<Record<string, string>>({});
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [receiptLinks, setReceiptLinks] = useState<{ pdf?: string; page?: string; receipt_id?: string }>({});
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [completingPayment, setCompletingPayment] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState<string | null>(null);
  const cachedUserProfile = useMemo(
    () => cachedStorageUser?.user ?? cachedStorageUser ?? null,
    [cachedStorageUser],
  );
  const currentUserId = cachedUserProfile?.id ?? cachedUserProfile?.user_id ?? cachedUserProfile?.uuid ?? null;
  const serviceId = useMemo(() => getServiceIdentifier(booking), [booking]);
  const shopId = useMemo(() => getShopIdentifier(booking), [booking]);
  const rosterEntries = useMemo(() => {
    const map = new Map<
      string,
      {
        userId: string;
        customer: ReturnType<typeof getBookingCustomer>;
        activities: any[];
      }
    >();
    serviceRoster.forEach((activity) => {
      const userId = getBookingUserId(activity);
      if (!userId) return;
      const existing = map.get(userId);
      if (existing) {
        existing.activities.push(activity);
      } else {
        map.set(userId, {
          userId,
          customer: getBookingCustomer(activity),
          activities: [activity],
        });
      }
    });
    return Array.from(map.values()).map((entry) => ({
      ...entry,
      activities: entry.activities
        .slice()
        .sort(
          (a, b) =>
            (new Date(b.created_at ?? b.booked_at ?? 0).getTime() || 0) -
            (new Date(a.created_at ?? a.booked_at ?? 0).getTime() || 0),
        ),
    }));
  }, [serviceRoster]);

  const loadBooking = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.commerce.serviceBooking(bookingId), {
        errorMessage: 'Unable to load booking details.',
      });
      if (res?.success) {
        setBooking(res.data ?? res);
        return;
      }
      setError(res?.message || 'Unable to load booking details.');
    } catch (e: any) {
      setError(e?.message || 'Unable to load booking details.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  const loadShopMembers = useCallback(async () => {
    if (!shopId) {
      setShopMembers([]);
      return;
    }
    try {
      const response = await getRequest(ROUTES.commerce.shopMembers(shopId), {
        errorMessage: 'Unable to load shop team.',
        forceNetwork: true,
      });
      if (response?.success) {
        const payload = response.data ?? response;
        const records = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as any).results)
          ? (payload as any).results
          : [];
        setShopMembers(records);
        setShopMembersError(null);
      } else {
        setShopMembers([]);
        setShopMembersError(response?.message || 'Unable to load shop team.');
      }
    } catch (error: any) {
      console.warn('Unable to load shop members', error);
      setShopMembers([]);
      setShopMembersError(error?.message || 'Unable to load shop team.');
    }
  }, [shopId]);

  useEffect(() => {
    void loadShopMembers();
  }, [loadShopMembers, shopId]);

  const isProvider = useMemo(() => {
    if (!booking || !currentUserId) return false;
    const providerId = booking?.provider_details?.id;
    return providerId && String(providerId) === String(currentUserId);
  }, [booking, currentUserId]);
  const isPayer = useMemo(() => {
    if (!booking || !currentUserId) return false;
    return String(getBookingUserId(booking)) === String(currentUserId);
  }, [booking, currentUserId]);
  const isShopTeamMember = useMemo(() => {
    if (!currentUserId || !shopMembers.length) return false;
    return shopMembers.some((member) => {
      const userShape = member?.user_details ?? member?.user ?? member ?? {};
      const memberId =
        userShape?.id ?? userShape?.user_id ?? member?.user_id ?? member?.id ?? null;
      const role = ((member?.role ?? userShape?.role ?? '') as string).toLowerCase();
      return memberId && String(memberId) === String(currentUserId) && MANAGEABLE_ROLES.has(role);
    });
  }, [currentUserId, shopMembers]);
  const hasRosterAccess = useMemo(() => Boolean(isProvider || isShopTeamMember), [isProvider, isShopTeamMember]);
  const canManageRosterActions = useMemo(() => Boolean(isShopTeamMember), [isShopTeamMember]);
  const loadBlockedUsers = useCallback(async () => {
    if (!hasRosterAccess) {
      setBlockedUsers({});
      return;
    }
    try {
      const response = await getRequest(ROUTES.moderation.userBlocks, {
        forceNetwork: true,
      });
      if (response?.success) {
        const payload = response.data ?? response;
        const records = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as any).results)
          ? (payload as any).results
          : [];
        const map: Record<string, string> = {};
        records.forEach((item: any) => {
          const blockedId =
            item?.blocked_id ??
            (item?.blocked?.id ? String(item?.blocked?.id) : null) ??
            (item?.blocked ? String(item?.blocked) : null);
          const blockId = item?.id;
          if (!blockedId || !blockId) return;
          map[String(blockedId)] = String(blockId);
        });
        setBlockedUsers(map);
        return;
      }
      throw new Error(response?.message || 'Unable to load blocked users.');
    } catch (error: any) {
      console.warn('Unable to load blocked users', error);
      setBlockedUsers({});
    }
  }, [hasRosterAccess]);
  const loadServiceRoster = useCallback(async () => {
    if (!serviceId) return;
    setServiceRosterLoading(true);
    setServiceRosterError(null);
    try {
      const response = await getRequest(ROUTES.commerce.serviceBookings, {
        errorMessage: 'Unable to load service bookings.',
        forceNetwork: true,
      });
      if (response?.success) {
        const payload = response.data ?? response;
        const records = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as any).results)
          ? (payload as any).results
          : [];
        const filtered = records.filter((entry: any) => getServiceIdentifier(entry) === serviceId);
        if (booking && !filtered.some((entry: any) => String(entry?.id) === String(booking?.id))) {
          filtered.unshift(booking);
        }
        setServiceRoster(filtered);
        setServiceRosterLoaded(true);
        return;
      }
      throw new Error(response?.message || 'Unable to load service bookings.');
    } catch (error: any) {
      console.warn('Unable to load service roster', error);
      setServiceRoster([]);
      setServiceRosterLoaded(false);
      setServiceRosterError(error?.message || 'Unable to load service roster.');
    } finally {
      setServiceRosterLoading(false);
    }
  }, [booking, serviceId]);
  const handleOpenRoster = useCallback(async () => {
    if (!serviceId) return;
    if (!serviceRosterLoaded) {
      await loadServiceRoster();
    }
    if (hasRosterAccess) {
      await loadBlockedUsers();
    }
    setRosterModalOpen(true);
  }, [loadServiceRoster, serviceId, serviceRosterLoaded, loadBlockedUsers, hasRosterAccess]);

  useEffect(() => {
    setServiceRoster([]);
    setServiceRosterLoaded(false);
    setServiceRosterError(null);
  }, [serviceId]);

  useEffect(() => {
    setExpandedUserId(null);
  }, [serviceId]);

  useEffect(() => {
    if (!serviceId) return;
    if (!hasRosterAccess) {
      setBlockedUsers({});
      return;
    }
    void loadBlockedUsers();
  }, [loadBlockedUsers, serviceId, hasRosterAccess]);

  const totalRosterActivities = serviceRoster.length;
  const uniqueRosterUsers = rosterEntries.length;
  const rosterSummaryText = serviceRosterLoading
    ? 'Loading booking list…'
    : totalRosterActivities
      ? `${totalRosterActivities} booking${totalRosterActivities === 1 ? '' : 's'} across ${uniqueRosterUsers} user${uniqueRosterUsers === 1 ? '' : 's'}`
      : 'Tap below to refresh the list.';

  const handleCancelRosterBooking = useCallback(
    async (bookingId: string) => {
      if (!bookingId) return;
      setCancellingBookingId(bookingId);
      try {
        const res = await postRequest(ROUTES.commerce.serviceBookingCancel(bookingId), {});
        if (!res?.success) {
          throw new Error(res?.message || 'Unable to cancel booking.');
        }
        Alert.alert('Booking', 'Booking canceled and the payer will be refunded.');
        await loadServiceRoster();
        loadBooking();
      } catch (error: any) {
        Alert.alert('Booking', error?.message || 'Unable to cancel booking.');
      } finally {
        setCancellingBookingId(null);
      }
    },
    [loadBooking, loadServiceRoster],
  );

  const handleBlockUser = useCallback(
    async (userId: string) => {
      if (!userId || !serviceId) return;
      const existingBlock = blockedUsers[userId];
      setBlockingUserId(userId);
      try {
        if (existingBlock) {
          const res = await deleteRequest(`${ROUTES.moderation.userBlocks}${existingBlock}/`, {
            errorMessage: 'Unable to unblock user.',
          });
          if (!res?.success) {
            throw new Error(res?.message || 'Unable to unblock user.');
          }
          setBlockedUsers((prev) => {
            const next = { ...prev };
            delete next[userId];
            return next;
          });
          Alert.alert('Users', 'User unblocked and can book this service again.');
          return;
        }
        const payload: Record<string, unknown> = {
          blocked: userId,
          reason: 'service roster block',
          service: serviceId,
        };
        if (shopId) {
          payload.shop = shopId;
        }
        const res = await postRequest(ROUTES.moderation.userBlocks, payload, {
          errorMessage: 'Unable to block user.',
        });
        if (!res?.success) {
          throw new Error(res?.message || 'Unable to block user.');
        }
        const body = res.data ?? res;
        const newBlockId = String(body?.id ?? '');
        if (!newBlockId) {
          throw new Error('Block response missing identifier.');
        }
        setBlockedUsers((prev) => ({ ...prev, [userId]: newBlockId }));
        Alert.alert('Users', 'User blocked from booking this service.');
      } catch (error: any) {
        Alert.alert('Users', error?.message || (existingBlock ? 'Unable to unblock user.' : 'Unable to block user.'));
      } finally {
        setBlockingUserId(null);
      }
    },
    [serviceId, shopId, blockedUsers],
  );

  const scheduledAt = booking?.scheduled_at ? new Date(booking.scheduled_at) : null;
  const serviceDetails = booking?.service_details ?? null;
  const availability = useMemo(
    () => normalizeAvailabilityPayload(serviceDetails?.availability ?? createDefaultAvailability({ timezone: 'UTC' })),
    [serviceDetails?.availability],
  );
  const availabilityRangeLabel = useMemo(
    () => formatAvailabilityRangeLabel(availability.date_range),
    [availability.date_range],
  );
  const dateOptions = useMemo(() => buildDateOptions(serviceDetails, availability), [availability, serviceDetails]);
  const availableSlots = useMemo(() => buildSlotsForDate(rescheduleDate, availability), [availability, rescheduleDate]);
  const selectedRescheduleSlot = useMemo(() => {
    if (!rescheduleDate || !rescheduleTime) return null;
    const [hour, minute] = rescheduleTime.split(':').map(Number);
    const slot = new Date(rescheduleDate);
    slot.setHours(hour, minute, 0, 0);
    return slot;
  }, [rescheduleDate, rescheduleTime]);
  const scheduledMs = scheduledAt?.getTime() ?? null;
  const serviceCancellationHours = Number(booking?.service_details?.cancellation_window_hours ?? 2);
  const normalizedCancellationHours =
    Number.isFinite(serviceCancellationHours) && serviceCancellationHours > 0 ? serviceCancellationHours : 2;
  const cancellationWindowMs = normalizedCancellationHours * 60 * 60 * 1000 || DEFAULT_CANCELLATION_WINDOW_MS;
  const serviceRescheduleHours = Number(serviceDetails?.reschedule_window_hours ?? 0);
  const normalizedRescheduleHours =
    Number.isFinite(serviceRescheduleHours) && serviceRescheduleHours > 0 ? serviceRescheduleHours : 0;
  const rescheduleWindowMs =
    normalizedRescheduleHours > 0 ? normalizedRescheduleHours * 60 * 60 * 1000 : DEFAULT_RESCHEDULE_WINDOW_MS;
  const refundPolicyText =
    String(booking?.service_details?.refund_policy ?? '').trim() ||
    `Cancel at least ${normalizedCancellationHours} hour${normalizedCancellationHours === 1 ? '' : 's'} before the scheduled time for a refund.`;
  const bookingMetadata = booking?.metadata ?? {};
  const packageSelection = bookingMetadata?.package_selection ?? null;
  const addonSelection = Array.isArray(bookingMetadata?.addon_selection) ? bookingMetadata.addon_selection : [];
  const acknowledgedRequirements = Array.isArray(bookingMetadata?.requirements_acknowledged)
    ? bookingMetadata.requirements_acknowledged
    : [];
  const bookingLocation = bookingMetadata?.location ?? null;
  const locationLabel = bookingLocation
    ? [
        bookingLocation.address_line1,
        bookingLocation.city,
        bookingLocation.state,
        bookingLocation.region,
        bookingLocation.country,
      ]
        .filter(Boolean)
        .join(', ')
    : '';
  const isScheduledInFuture = scheduledMs ? scheduledMs > currentTime : false;
  const meetsNoticeWindow = scheduledMs ? scheduledMs - currentTime >= cancellationWindowMs : false;
  const cancellableStatuses = ['pending', 'confirmed'];
  const hasCancellableStatus = cancellableStatuses.includes(booking?.status ?? '');
  const canCancelBooking = Boolean(isPayer && hasCancellableStatus && isScheduledInFuture && meetsNoticeWindow);
  const canManageSchedule = Boolean(isPayer || isProvider || isShopTeamMember);
  const meetsRescheduleWindow =
    scheduledMs && rescheduleWindowMs > 0 ? scheduledMs - currentTime >= rescheduleWindowMs : true;
  const canRescheduleBooking = Boolean(canManageSchedule && hasCancellableStatus && isScheduledInFuture && meetsRescheduleWindow);
  const cancellationDisabledReason = useMemo(() => {
    if (!isPayer) return null;
    if (!hasCancellableStatus) return 'Only pending or confirmed bookings can be canceled.';
    if (!scheduledAt) return 'Scheduled time is unavailable.';
    if (!isScheduledInFuture) return 'The service date/time has already passed.';
    if (!meetsNoticeWindow) return refundPolicyText;
    return null;
  }, [isPayer, hasCancellableStatus, scheduledAt, isScheduledInFuture, meetsNoticeWindow, refundPolicyText]);
  const rescheduleDisabledReason = useMemo(() => {
    if (!canManageSchedule) return 'Only the payer, provider, or shop managers can reschedule this booking.';
    if (!hasCancellableStatus) return 'Only pending or confirmed bookings can be rescheduled.';
    if (!scheduledAt) return 'Scheduled time is unavailable.';
    if (!isScheduledInFuture) return 'The service date/time has already passed.';
    if (!meetsRescheduleWindow) {
      return `Reschedule requests must be made at least ${normalizedRescheduleHours} hour${normalizedRescheduleHours === 1 ? '' : 's'} before the original slot.`;
    }
    return null;
  }, [canManageSchedule, hasCancellableStatus, isScheduledInFuture, meetsRescheduleWindow, normalizedRescheduleHours, scheduledAt]);

  useEffect(() => {
    if (!dateOptions.length) return;
    setRescheduleDate((prev) => {
      if (prev) {
        const match = dateOptions.find((option) => option.toDateString() === prev.toDateString());
        if (match) return match;
      }
      return dateOptions[0];
    });
  }, [dateOptions]);

  useEffect(() => {
    if (!availableSlots.length) {
      setRescheduleTime(null);
      return;
    }
    setRescheduleTime((prev) => {
      if (prev) {
        const keep = availableSlots.find((slot) => slot.time === prev && slot.enabled);
        if (keep) return prev;
      }
      const next = availableSlots.find((slot) => slot.enabled);
      return next?.time ?? availableSlots[0].time;
    });
  }, [availableSlots]);

  const handleCancelBooking = useCallback(async () => {
    if (!bookingId || !canCancelBooking) return;
    setCancelLoading(true);
    try {
      const res = await postRequest(ROUTES.commerce.serviceBookingCancel(bookingId), {});
      if (!res?.success) {
        throw new Error(res?.message || 'Unable to cancel booking.');
      }
      Alert.alert('Booking', 'Your booking has been canceled.');
      loadBooking();
    } catch (e: any) {
      Alert.alert('Booking', e?.message || 'Unable to cancel booking.');
    } finally {
      setCancelLoading(false);
    }
  }, [bookingId, canCancelBooking, loadBooking]);

  const expiryLabel = useMemo(() => {
    if (!booking?.satisfaction_deadline) return null;
    const date = new Date(booking.satisfaction_deadline);
    return date.toLocaleString();
  }, [booking?.satisfaction_deadline]);

  const handleMarkCompleted = useCallback(async () => {
    if (!bookingId) return;
    setActionLoading(true);
    try {
      const res = await postRequest(`${ROUTES.commerce.serviceBooking(bookingId)}mark-completed/`, {});
      if (!res?.success) {
        throw new Error(res?.message || 'Unable to mark completed.');
      }
      Alert.alert('Booking', 'Marked as completed. The payer will confirm satisfaction.');
      loadBooking();
    } catch (e: any) {
      Alert.alert('Booking', e?.message || 'Unable to mark completed.');
    } finally {
      setActionLoading(false);
    }
  }, [bookingId, loadBooking]);

  const handleRescheduleBooking = useCallback(async () => {
    if (!bookingId || !selectedRescheduleSlot || !canRescheduleBooking) return;
    setRescheduleLoading(true);
    setRescheduleError(null);
    try {
      const res = await postRequest(
        ROUTES.commerce.serviceBookingReschedule(bookingId),
        { scheduled_at: selectedRescheduleSlot.toISOString() },
        { errorMessage: 'Unable to reschedule booking.' },
      );
      if (!res?.success) {
        const message =
          res?.data?.message || res?.data?.detail || res?.message || 'Unable to reschedule booking.';
        throw new Error(message);
      }
      Alert.alert('Booking', `Booking rescheduled to ${formatSlotLabel(selectedRescheduleSlot)}.`);
      setRescheduleOpen(false);
      loadBooking();
    } catch (e: any) {
      setRescheduleError(e?.message || 'Unable to reschedule booking.');
    } finally {
      setRescheduleLoading(false);
    }
  }, [bookingId, canRescheduleBooking, loadBooking, selectedRescheduleSlot]);

  const handleMarkSatisfied = useCallback(async () => {
    if (!booking?.payment?.id) {
      Alert.alert('Booking', 'Payment details are missing.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await patchRequest(ROUTES.commerce.paymentSatisfy(booking.payment.id), {});
      if (!res?.success) {
        throw new Error(res?.message || 'Unable to mark satisfied.');
      }
      Alert.alert('Booking', 'Thank you for confirming the service.');
      loadBooking();
    } catch (e: any) {
      Alert.alert('Booking', e?.message || 'Unable to mark satisfied.');
    } finally {
      setActionLoading(false);
    }
  }, [booking?.payment?.id, loadBooking]);

  const handleOpenLink = useCallback((url?: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      Alert.alert('Meeting link', 'Unable to open the meeting link.');
    });
  }, []);

  const openReceipt = useCallback((url?: string) => {
    if (!url) {
      Alert.alert('Receipt', 'Receipt link is missing.');
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert('Receipt', 'Unable to open receipt link.');
    });
  }, []);

  const handleUploadReceipt = useCallback(async () => {
    try {
      setUploadingReceipt(true);
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf],
      });
      if (!result?.uri) {
        throw new Error('Selected file is unavailable.');
      }
      const form = new FormData();
      form.append('attachment', {
        uri: result.uri,
        name: result.name || `receipt-${Date.now()}.pdf`,
        type: result.type || 'application/pdf',
      } as any);
      const uploadRes = await postRequest(ROUTES.broadcasts.profileAttachment, form);
      if (!uploadRes?.success) {
        throw new Error(uploadRes?.message || 'Unable to upload receipt.');
      }
      const attachment = uploadRes.data?.attachment;
      const receiptUrl = String(attachment?.url || attachment?.file || attachment?.file_url || '');
      if (!receiptUrl) throw new Error('Uploaded receipt URL missing.');
      setComplaintData((prev) => ({ ...prev, receiptUrl }));
    } catch (e: any) {
      if (!DocumentPicker.isCancel(e)) {
        Alert.alert('Receipt', e?.message || 'Unable to upload receipt.');
      }
    } finally {
      setUploadingReceipt(false);
    }
  }, []);

  const handleSubmitComplaint = useCallback(async () => {
    if (!booking) return;
    if (!complaintData.personalStatement.trim() || !complaintData.reason.trim()) {
      Alert.alert('Complaint', 'Please explain your reason and personal statement.');
      return;
    }
    setSubmittingComplaint(true);
    try {
      const payload = {
        booking: booking.id,
        escrow: booking.escrow_id || booking.escrow?.id,
        transaction_reference: booking.payment_tx_ref,
        receipt_url: complaintData.receiptUrl,
        personal_statement: complaintData.personalStatement.trim(),
        reason: complaintData.reason.trim(),
      } as Record<string, unknown>;
      const res = await postRequest(ROUTES.commerce.serviceBookingComplaints, payload, {
        errorMessage: 'Unable to submit complaint.',
      });
      if (!res?.success) {
        throw new Error(res?.message || 'Unable to submit complaint.');
      }
      Alert.alert('Complaint', 'Your dispute has been submitted for review.');
      setComplaintOpen(false);
      setComplaintData({ personalStatement: '', reason: '', receiptUrl: '' });
      loadBooking();
    } catch (e: any) {
      Alert.alert('Complaint', e?.message || 'Unable to submit complaint.');
    } finally {
      setSubmittingComplaint(false);
    }
  }, [booking, complaintData, loadBooking]);

  const payment = booking?.payment ?? null;
  const paymentStatusValue = payment?.payment_status?.toLowerCase() || 'pending';
  const paymentStatusLabel =
    paymentStatusValue === 'satisfied'
      ? 'Satisfied'
      : paymentStatusValue === 'paid'
        ? 'Paid'
        : paymentStatusValue === 'refunded'
          ? 'Refunded'
          : paymentStatusValue === 'failed'
            ? 'Failed'
            : 'Pending';
  const depositAmountCents = Number.isFinite(Number(booking?.deposit_cents))
    ? booking?.deposit_cents ?? 0
    : payment?.amount_cents ?? 0;
  const balanceAmountCents = Number.isFinite(Number(booking?.balance_cents))
    ? booking?.balance_cents ?? 0
    : Math.max((booking?.price_cents ?? 0) - depositAmountCents, 0);
  const remainingAmountLabel = formatKisc(balanceAmountCents);
  const amount = formatKisc(booking?.price_cents ?? payment?.amount_cents ?? depositAmountCents);
  const depositAmountLabel = formatKisc(depositAmountCents);
  const currency = payment?.currency ?? 'KISC';
  const durationText = booking?.service_details?.duration_minutes
    ? `${booking.service_details.duration_minutes} min`
    : 'Duration TBD';
  const deliveryModes = (booking?.service_details?.delivery_modes || []).join(', ') || 'In-person';
  const bookedDate = scheduledAt
    ? scheduledAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Date TBD';
  const bookedTime = scheduledAt
    ? scheduledAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : 'Time TBD';
  const bookingStatusLabel = String(booking?.status || '').replace(/_/g, ' ') || 'Status TBD';
  const paymentStatusColor =
    paymentStatusValue === 'pending'
      ? palette.warning
      : paymentStatusValue === 'failed' || paymentStatusValue === 'refunded'
        ? palette.error ?? palette.warning
        : palette.success;

  const handlePayRemaining = useCallback(() => {
    if (!bookingId || balanceAmountCents <= 0) return;
    Alert.alert(
      'Complete payment',
      `Are you sure you want to pay the remaining ${remainingAmountLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, pay now',
          onPress: async () => {
            setCompletingPayment(true);
            try {
              const res = await postRequest(
                ROUTES.commerce.serviceBookingPayRemaining(bookingId),
                {},
                { errorMessage: 'Unable to complete the remaining payment.' },
              );
              if (!res?.success) {
                throw new Error(res?.message || 'Unable to complete the remaining payment.');
              }
              Alert.alert('Booking', 'Remaining payment completed.');
              loadBooking();
            } catch (e: any) {
              Alert.alert('Payment', e?.message || 'Unable to complete the remaining payment.');
            } finally {
              setCompletingPayment(false);
            }
          },
        },
      ],
    );
  }, [balanceAmountCents, bookingId, loadBooking, remainingAmountLabel]);

  const fetchReceiptLinks = useCallback(async () => {
    if (!bookingId) {
      throw new Error('Booking reference is missing.');
    }
    setLoadingReceipt(true);
    try {
      const response = await getRequest(ROUTES.commerce.serviceBookingReceipt(bookingId), {
        errorMessage: 'Unable to load booking receipt.',
        forceNetwork: true,
      });
      if (!response?.success || !response?.data) {
        throw new Error(response?.message || 'Booking receipt unavailable.');
      }
      const data = response.data ?? {};
      const links = {
        pdf: data.receipt_pdf_url || undefined,
        page: data.receipt_url || undefined,
        receipt_id: data.receipt_id || undefined,
      };
      if (!links.pdf && !links.page) {
        throw new Error('Booking receipt links are missing.');
      }
      setReceiptLinks((prev) => ({
        ...prev,
        ...links,
      }));
      return links;
    } finally {
      setLoadingReceipt(false);
    }
  }, [bookingId]);

  const [regeneratingReceipt, setRegeneratingReceipt] = useState(false);

  const handleRegenerateReceipt = useCallback(async () => {
    if (!bookingId) {
      Alert.alert('Receipt', 'Booking reference is missing.');
      return;
    }
    setRegeneratingReceipt(true);
    try {
      const payload: Record<string, string> = {};
      if (receiptLinks.receipt_id) {
        payload.receipt_id = receiptLinks.receipt_id;
      }
      const response = await postRequest(
        ROUTES.commerce.serviceBookingReceiptRegenerate(bookingId),
        payload,
        { errorMessage: 'Unable to regenerate receipt.' },
      );
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to regenerate receipt.');
      }
      const data = response.data ?? response ?? {};
      const links = {
        pdf: data.receipt_pdf_url ?? data.receipt_url,
        page: data.receipt_url ?? data.receipt_pdf_url,
      };
      if (!links.pdf && !links.page) {
        throw new Error('Receipt links are missing.');
      }
      setReceiptLinks((prev) => ({
        ...prev,
        ...links,
        receipt_id: data.receipt_id ?? prev.receipt_id,
      }));
      Alert.alert('Receipt', 'Receipt regenerated. You can download it below.');
    } catch (error: any) {
      Alert.alert('Receipt', error?.message || 'Unable to regenerate receipt.');
    } finally {
      setRegeneratingReceipt(false);
    }
  }, [bookingId, receiptLinks.receipt_id]);

  const handleDownloadReceipt = useCallback(async () => {
    if (!bookingId) {
      Alert.alert('Receipt', 'Booking reference is missing.');
      return;
    }
    try {
      const existingUrl = receiptLinks.pdf || receiptLinks.page;
      const links = existingUrl ? receiptLinks : await fetchReceiptLinks();
      const targetUrl = links?.pdf || links?.page;
      if (!targetUrl) {
        throw new Error('Receipt not available.');
      }
      openReceipt(targetUrl);
    } catch (error: any) {
      Alert.alert('Receipt', error?.message || 'Unable to load receipt.');
    }
  }, [bookingId, fetchReceiptLinks, openReceipt, receiptLinks]);

  const hasPaymentReference = Boolean(
    booking?.payment?.transaction_reference || booking?.payment_tx_ref,
  );
  const showReceiptsSection = Boolean(bookingId);
  useEffect(() => {
    if (hasPaymentReference) {
      void fetchReceiptLinks();
    }
  }, [fetchReceiptLinks, hasPaymentReference]);

  const receiptActions = useMemo(() => {
    const items: { key: string; label: string; hint: string; url: string }[] = [];
    if (receiptLinks.pdf) {
      items.push({
        key: 'pdf',
        label: 'Download PDF receipt',
        hint: 'High-quality copy (mirrors /media/billing/receipts/).',
        url: receiptLinks.pdf,
      });
    }
    if (receiptLinks.page) {
      items.push({
        key: 'page',
        label: 'Open receipt page',
        hint: 'See the hosted receipt design.',
        url: receiptLinks.page,
      });
    }
    return items;
  }, [receiptLinks]);

  const showComplaintPrompt = useMemo(() => {
    return (
      booking?.status === 'awaiting_satisfaction' &&
      isPayer &&
      booking?.provider_completed_at &&
      !booking?.payer_satisfied_at &&
      !booking?.has_open_complaint
    );
  }, [booking, isPayer]);

  const completionDeadlineMs = booking?.satisfaction_deadline
    ? new Date(booking.satisfaction_deadline).getTime()
    : null;
  const remainingMs =
    completionDeadlineMs !== null && completionDeadlineMs !== undefined
      ? completionDeadlineMs - currentTime
      : null;
  const countdownLabel =
    remainingMs === null
      ? null
      : remainingMs > 0
        ? `Auto-release in ${formatDurationLabel(remainingMs)}`
        : 'Auto-release overdue';
  const showCompletionNotice =
    booking?.status === 'awaiting_satisfaction' && isPayer && !booking?.payer_satisfied_at;
  const completionProviderName = booking?.provider_details?.display_name || booking?.shop_name || 'Provider';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.primaryStrong} />
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: palette.text, marginBottom: 12 }}>{error || 'Booking not found.'}</Text>
        <KISButton title="Close" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const meetingLink =
    booking?.remote_meeting_link ||
    booking?.service_details?.remote_meeting_link ||
    booking?.service_details?.remote_meeting_link;
  const showCompletePaymentButton = isPayer && !isProvider && balanceAmountCents > 0;
  const showSatisfiedButton =
    isPayer &&
    balanceAmountCents <= 0 &&
    paymentStatusValue === 'paid';
  const normalizedBookingStatus = String(booking?.status ?? '').toLowerCase();
  const completionLockedStatuses = new Set([
    'awaiting_satisfaction',
    'completed',
    'satisfied',
    'cancelled',
    'canceled',
    'rejected',
  ]);
  const showMarkCompletedButton =
    (isProvider || isShopTeamMember) &&
    paymentStatusValue === 'paid' &&
    !booking?.provider_completed_at &&
    !completionLockedStatuses.has(normalizedBookingStatus);
  const cardStyle = {
    backgroundColor: palette.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.divider,
    padding: 16,
  };
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: palette.divider,
        backgroundColor: palette.surface,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>Booking details</Text>
          <Text style={{ color: palette.subtext, fontSize: 13 }}>{booking?.service_name}</Text>
        </View>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{ color: palette.primaryStrong, fontWeight: '600' }}>Close</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={cardStyle}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>Booking details</Text>
          <Text style={{ color: palette.subtext, marginTop: 4 }}>{booking?.service_details?.description || 'No additional description provided.'}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
            <Text style={{ color: palette.text }}>Date</Text>
            <Text style={{ color: palette.text, fontWeight: '600' }}>{bookedDate}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: palette.text }}>Time</Text>
            <Text style={{ color: palette.text, fontWeight: '600' }}>{bookedTime}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: palette.text }}>Duration</Text>
            <Text style={{ color: palette.text, fontWeight: '600' }}>{durationText}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: palette.text }}>Mode</Text>
            <Text style={{ color: palette.text, fontWeight: '600' }}>{deliveryModes}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: palette.text }}>Status</Text>
            <Text style={{ color: palette.primaryStrong, fontWeight: '600' }}>{bookingStatusLabel}</Text>
          </View>
          {packageSelection?.name ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: palette.text }}>Package</Text>
              <Text style={{ color: palette.text, fontWeight: '600' }}>{packageSelection.name}</Text>
            </View>
          ) : null}
          {addonSelection.length ? (
            <View style={{ marginTop: 6 }}>
              <Text style={{ color: palette.text }}>Add-ons</Text>
              <Text style={{ color: palette.text, fontWeight: '600', marginTop: 2 }}>
                {addonSelection.map((entry: any) => entry?.name).filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : null}
          {bookingMetadata?.requested_price ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: palette.text }}>Requested price</Text>
              <Text style={{ color: palette.text, fontWeight: '600' }}>
                {formatKiscAmount(Number(bookingMetadata.requested_price))}
              </Text>
            </View>
          ) : null}
          {bookingMetadata?.participant_count ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: palette.text }}>Participants</Text>
              <Text style={{ color: palette.text, fontWeight: '600' }}>{bookingMetadata.participant_count}</Text>
            </View>
          ) : null}
          {bookingMetadata?.staff_on_site ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: palette.text }}>Staff on site</Text>
              <Text style={{ color: palette.text, fontWeight: '600' }}>{bookingMetadata.staff_on_site}</Text>
            </View>
          ) : null}
          {locationLabel ? (
            <View style={{ marginTop: 6 }}>
              <Text style={{ color: palette.text }}>Location</Text>
              <Text style={{ color: palette.text, fontWeight: '600', marginTop: 2 }}>{locationLabel}</Text>
            </View>
          ) : null}
          {bookingMetadata?.remote_region ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: palette.text }}>Remote region</Text>
              <Text style={{ color: palette.text, fontWeight: '600' }}>{bookingMetadata.remote_region}</Text>
            </View>
          ) : null}
          {acknowledgedRequirements.length ? (
            <View style={{ marginTop: 6 }}>
              <Text style={{ color: palette.text }}>Requirements acknowledged</Text>
              <Text style={{ color: palette.text, fontWeight: '600', marginTop: 2 }}>
                {acknowledgedRequirements.join(', ')}
              </Text>
            </View>
          ) : null}
          {bookingMetadata?.terms_accepted ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: palette.text }}>Terms</Text>
              <Text style={{ color: palette.text, fontWeight: '600' }}>Accepted</Text>
            </View>
          ) : null}
          {hasPaymentReference ? (
            <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
              <KISButton
                title="Regenerate receipt"
                size="sm"
                variant="outline"
                onPress={handleRegenerateReceipt}
                loading={regeneratingReceipt}
                disabled={regeneratingReceipt}
              />
              <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
                Regenerates the receipt stored in _/media/billing/receipts/_ so you can download the fresh PDF.
              </Text>
            </View>
          ) : null}
          {meetingLink ? (
            <Pressable onPress={() => handleOpenLink(meetingLink)} style={{ marginTop: 12 }}>
              <Text style={{ color: palette.primaryStrong }}>Open meeting link</Text>
              <Text style={{ color: palette.text, fontSize: 12 }}>{meetingLink}</Text>
            </Pressable>
          ) : null}
          {isPayer && (
            <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.divider }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>Cancel booking</Text>
              <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
                {refundPolicyText}
              </Text>
              <KISButton
                title="Cancel booking"
                variant="secondary"
                onPress={handleCancelBooking}
                loading={cancelLoading}
                disabled={!canCancelBooking || cancelLoading}
                style={{ marginTop: 8 }}
              />
              {cancellationDisabledReason ? (
                <Text style={{ color: palette.warning, fontSize: 12, marginTop: 4 }}>{cancellationDisabledReason}</Text>
              ) : null}
            </View>
          )}
          <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.divider }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>Reschedule booking</Text>
            <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
              {normalizedRescheduleHours > 0
                ? `Reschedule requests must be made at least ${normalizedRescheduleHours} hour${normalizedRescheduleHours === 1 ? '' : 's'} before the original slot.`
                : 'Pick a new slot and we will re-check availability before updating the booking.'}
            </Text>
            <KISButton
              title="Reschedule booking"
              variant="outline"
              onPress={() => {
                setRescheduleError(null);
                setRescheduleOpen(true);
              }}
              disabled={!canRescheduleBooking}
              style={{ marginTop: 8 }}
            />
            {rescheduleDisabledReason ? (
              <Text style={{ color: palette.warning, fontSize: 12, marginTop: 4 }}>{rescheduleDisabledReason}</Text>
            ) : null}
            {Array.isArray(bookingMetadata?.reschedules) && bookingMetadata.reschedules.length ? (
              <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 6 }}>
                Last reschedule: {formatTimestamp(bookingMetadata.reschedules[bookingMetadata.reschedules.length - 1]?.to)}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={cardStyle}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>Payment details</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
            <Text style={{ color: palette.text }}>Amount</Text>
            <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>{amount}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: palette.text }}>Deposit paid</Text>
            <Text style={{ color: palette.text, fontWeight: '600' }}>{depositAmountLabel}</Text>
          </View>
          {balanceAmountCents > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: palette.text }}>Remaining</Text>
              <Text style={{ color: palette.text, fontWeight: '600' }}>{remainingAmountLabel}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: palette.text }}>Currency</Text>
            <Text style={{ color: palette.text, fontWeight: '600' }}>{currency}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: palette.text }}>Payment status</Text>
            <Text style={{ color: paymentStatusColor, fontWeight: '600' }}>{paymentStatusLabel}</Text>
          </View>
          {payment?.paid_at ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: palette.text }}>Paid at</Text>
              <Text style={{ color: palette.text, fontWeight: '600' }}>{new Date(payment.paid_at).toLocaleString()}</Text>
            </View>
          ) : null}
          {payment?.payment_method ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: palette.text }}>Method</Text>
              <Text style={{ color: palette.text, fontWeight: '600' }}>{payment.payment_method}</Text>
            </View>
          ) : null}
          <View style={{ marginTop: 6 }}>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>Reference · {payment?.transaction_reference || booking?.payment_tx_ref || '—'}</Text>
            {payment?.notes ? (
              <Text style={{ color: palette.subtext, fontSize: 12 }}>Notes · {payment.notes}</Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {showCompletePaymentButton && (
              <KISButton
                title="Complete payment"
                size="sm"
                onPress={handlePayRemaining}
                loading={completingPayment}
                disabled={balanceAmountCents <= 0 || completingPayment}
              />
            )}
            {showSatisfiedButton && (
              <KISButton title="Mark Satisfied" size="sm" onPress={handleMarkSatisfied} loading={actionLoading} />
            )}
          </View>
        </View>

        {showReceiptsSection ? (
          <View style={[cardStyle, { gap: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>Receipts</Text>
              <KISButton
                title="Regenerate receipt"
                size="sm"
                variant="ghost"
                onPress={handleRegenerateReceipt}
                loading={regeneratingReceipt}
                disabled={regeneratingReceipt}
              />
            </View>
            <Text style={{ color: palette.subtext, fontSize: 13 }}>
              Download a copy of the receipt that matches the styling stored under /media/billing/receipts/.
            </Text>
            {loadingReceipt && !receiptActions.length ? (
              <ActivityIndicator color={palette.primaryStrong} />
            ) : receiptActions.length ? (
              receiptActions.map((action) => (
                <View key={action.key} style={{ gap: 6 }}>
                  <KISButton
                    title={action.label}
                    size="sm"
                    variant="ghost"
                    onPress={() => openReceipt(action.url)}
                  />
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>{action.hint}</Text>
                </View>
              ))
            ) : (
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Tap the button below to generate the receipt and download whenever you need it.
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <KISButton
                title={receiptActions.length ? 'Download receipt' : 'Generate receipt'}
                size="sm"
                variant="outline"
                onPress={handleDownloadReceipt}
                loading={loadingReceipt}
              />
            </View>
          </View>
        ) : null}

        {showCompletionNotice ? (
          <View style={[cardStyle, { borderWidth: 1.5, borderColor: palette.warning }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: palette.warning }}>
              {completionProviderName} marked this service as completed.
            </Text>
            <Text style={{ color: palette.subtext, marginTop: 6 }}>
              Please confirm satisfaction within the 3-day window so the payment can be released.
            </Text>
            {countdownLabel ? (
              <Text style={{ color: palette.subtext, marginTop: 8 }}>Countdown: {countdownLabel}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={cardStyle}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>Provider</Text>
          <Text style={{ color: palette.text, fontWeight: '600', marginTop: 6 }}>{booking?.provider_details?.display_name || booking?.shop_name}</Text>
          {booking?.provider_details?.phone ? (
            <Text style={{ color: palette.subtext }}>{booking.provider_details.phone}</Text>
          ) : null}
          {booking?.provider_details?.email ? (
            <Text style={{ color: palette.subtext }}>{booking.provider_details.email}</Text>
          ) : null}
        </View>

        <View style={cardStyle}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>Your instructions</Text>
          <Text style={{ color: palette.subtext, marginTop: 4 }}>{booking?.instructions || 'No notes provided.'}</Text>
        </View>

        <View style={cardStyle}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>Metadata</Text>
          <View style={{ marginTop: 8, gap: 6 }}>
            <Text style={{ color: palette.subtext }}>Booking reference: {booking.payment_tx_ref || booking.id}</Text>
            <Text style={{ color: palette.subtext }}>Created at: {booking?.created_at ? new Date(booking.created_at).toLocaleString() : '—'}</Text>
            {booking?.escrow_locked_at ? (
              <Text style={{ color: palette.subtext }}>Escrow locked: {new Date(booking.escrow_locked_at).toLocaleString()}</Text>
            ) : null}
            {booking?.provider_completed_at ? (
              <Text style={{ color: palette.subtext }}>Provider completed: {new Date(booking.provider_completed_at).toLocaleString()}</Text>
            ) : null}
            {booking?.payer_satisfied_at ? (
              <Text style={{ color: palette.subtext }}>You marked satisfied: {new Date(booking.payer_satisfied_at).toLocaleString()}</Text>
            ) : null}
            {expiryLabel ? (
              <Text style={{ color: palette.subtext }}>Satisfaction deadline: {expiryLabel}</Text>
            ) : null}
            {payment?.satisfied_at ? (
              <Text style={{ color: palette.subtext }}>Payment satisfied: {new Date(payment.satisfied_at).toLocaleString()}</Text>
            ) : null}
          </View>
        </View>

        {hasRosterAccess && serviceId ? (
          <View style={cardStyle}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>Service roster</Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }}>
              {`View everyone who booked ${booking?.service_name || 'this service'}, along with their activities.`}
            </Text>
            {serviceRosterError ? (
              <Text style={{ color: palette.warning, marginTop: 6 }}>{serviceRosterError}</Text>
            ) : null}
            <Text style={{ color: palette.subtext, marginTop: 8, fontSize: 12 }}>
              Owners/managers can cancel or block from the roster modal before reloading the list.
            </Text>
            <Text style={{ color: palette.subtext, marginTop: 6, fontSize: 12 }}>{rosterSummaryText}</Text>
            <View style={{ marginTop: 12 }}>
              <KISButton
                title="View bookings"
                size="sm"
                variant="outline"
                onPress={handleOpenRoster}
                loading={serviceRosterLoading}
              />
            </View>
          </View>
        ) : null}

        {showMarkCompletedButton && (
          <KISButton title="Mark Completed" onPress={handleMarkCompleted} loading={actionLoading} />
        )}
        {showComplaintPrompt && (
          <View style={{ backgroundColor: palette.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: palette.warning }}>
            <Text style={{ color: palette.text, fontWeight: '600' }}>Provider marked service as completed.</Text>
            <Text style={{ color: palette.subtext, marginVertical: 8 }}>
              {countdownLabel
                ? `You can open a complaint during the current review window. ${countdownLabel}.`
                : 'You can submit a complaint during the active review window if the service was unsatisfactory.'}
            </Text>
            <KISButton title="Submit complaint" variant="secondary" onPress={() => setComplaintOpen(true)} />
          </View>
        )}
      </ScrollView>

      <Modal visible={rosterModalOpen} transparent animationType="slide">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setRosterModalOpen(false)}>
          <View style={{ flex: 1 }} />
        </Pressable>
        <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '85%' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>Service bookings</Text>
          <Text style={{ color: palette.subtext, marginTop: 4 }}>
            {`All users who booked ${booking?.service_name || 'this service'}.`}
          </Text>
          {serviceRosterError ? (
            <Text style={{ color: palette.warning, marginTop: 8 }}>{serviceRosterError}</Text>
          ) : null}
          {serviceRosterLoading && !rosterEntries.length ? (
            <ActivityIndicator color={palette.primaryStrong} style={{ marginTop: 12 }} />
          ) : null}
          {rosterEntries.length ? (
            <ScrollView style={{ marginTop: 12, maxHeight: 360 }}>
              {rosterEntries.map((entry, index) => {
                const isExpanded = expandedUserId === entry.userId;
                const activeBooking = entry.activities.find((activity) => !isBookingCancelled(activity));
                const summaryStatus = String(
                  (activeBooking?.status ?? entry.activities[0]?.status ?? 'pending'),
                ).replace(/_/g, ' ');
                const isUserBlocked = Boolean(blockedUsers[entry.userId]);
                const scheduledAtForActive = activeBooking?.scheduled_at
                  ? new Date(activeBooking.scheduled_at)
                  : null;
                const timeUntilScheduled =
                  scheduledAtForActive !== null ? scheduledAtForActive.getTime() - currentTime : null;
                const withinCancellationWindow =
                  typeof timeUntilScheduled === 'number' && timeUntilScheduled >= cancellationWindowMs;
                const rosterActionsEnabled =
                  Boolean(activeBooking && !isBookingCancelled(activeBooking)) && withinCancellationWindow;
                const actionContainerOpacity = rosterActionsEnabled ? 1 : 0.45;
                return (
                  <View
                    key={`roster-user-${entry.userId}-${index}`}
                    style={{
                      paddingVertical: 12,
                      borderBottomWidth: index === rosterEntries.length - 1 ? 0 : 1,
                      borderBottomColor: palette.divider,
                    }}
                  >
                    <Pressable
                      onPress={() => setExpandedUserId(isExpanded ? null : entry.userId)}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>
                          {entry.customer.name}
                        </Text>
                        <Text style={{ color: palette.subtext, fontSize: 12 }}>
                          {entry.customer.phone || entry.customer.email || 'No contact info'}
                        </Text>
                        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
                          {`${entry.activities.length} activity${entry.activities.length === 1 ? '' : 'ies'} · ${summaryStatus}`}
                        </Text>
                      </View>
                      <Text style={{ color: palette.primaryStrong, fontSize: 12 }}>
                        {isExpanded ? 'Hide' : 'Show'}
                      </Text>
                    </Pressable>
                    {canManageRosterActions ? (
                      <View
                        style={{
                          marginTop: 8,
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 8,
                          opacity: rosterActionsEnabled ? 1 : 0.45,
                        }}
                      >
                        {activeBooking ? (
                          <KISButton
                            title="Cancel booking"
                            size="xs"
                            variant="outline"
                            onPress={() => handleCancelRosterBooking(String(activeBooking.id))}
                            loading={cancellingBookingId === String(activeBooking.id)}
                            disabled={
                              cancellingBookingId === String(activeBooking.id) || !rosterActionsEnabled
                            }
                          />
                        ) : (
                          <KISButton title="Cancel booking" size="xs" variant="outline" disabled />
                        )}
                        <KISButton
                          title={isUserBlocked ? 'Unblock user' : 'Block user'}
                          size="xs"
                          variant={isUserBlocked ? 'outline' : 'secondary'}
                          onPress={() => handleBlockUser(entry.userId)}
                          loading={blockingUserId === entry.userId}
                          disabled={blockingUserId === entry.userId || !rosterActionsEnabled}
                        />
                      </View>
                    ) : null}
                    {isExpanded && (
                      <View style={{ marginTop: 10, gap: 8 }}>
                        {entry.activities.map((activity, activityIndex) => {
                          const scheduledLabel = formatTimestamp(activity?.scheduled_at);
                          const createdLabel = formatTimestamp(activity?.created_at ?? activity?.booked_at);
                          const statusLabel = String(activity?.status || 'pending').replace(/_/g, ' ');
                          const paymentStatus =
                            activity?.payment?.payment_status ??
                            activity?.payment_status ??
                            activity?.payment?.status ??
                            '—';
                          return (
                            <View
                              key={`activity-${activity?.id ?? activityIndex}`}
                              style={{
                                paddingBottom: activityIndex === entry.activities.length - 1 ? 0 : 8,
                                borderBottomWidth: activityIndex === entry.activities.length - 1 ? 0 : 1,
                                borderBottomColor: palette.divider,
                              }}
                            >
                              <Text style={{ color: palette.text, fontWeight: '600' }}>
                                Activity {activityIndex + 1}
                              </Text>
                              <Text style={{ color: palette.subtext, fontSize: 12 }}>Status · {statusLabel}</Text>
                              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                                Scheduled for · {scheduledLabel}
                              </Text>
                              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                                Booked at · {createdLabel}
                              </Text>
                              <Text style={{ color: palette.subtext, fontSize: 12 }}>Payment · {paymentStatus}</Text>
                            </View>
                          );
                        })}
                        {canManageRosterActions ? (
                          <View
                            style={{
                              marginTop: 12,
                              gap: 8,
                              opacity: rosterActionsEnabled ? 1 : 0.45,
                            }}
                          >
                            {activeBooking && !isBookingCancelled(activeBooking) ? (
                              <KISButton
                                title="Cancel booking"
                                size="xs"
                                variant="outline"
                                onPress={() => handleCancelRosterBooking(String(activeBooking.id))}
                                loading={cancellingBookingId === String(activeBooking.id)}
                                disabled={
                                  cancellingBookingId === String(activeBooking.id) ||
                                  !rosterActionsEnabled
                                }
                              />
                            ) : null}
                            <KISButton
                              title={isUserBlocked ? 'User blocked' : 'Block user'}
                              size="xs"
                              variant={isUserBlocked ? 'outline' : 'secondary'}
                              onPress={() => handleBlockUser(entry.userId)}
                              loading={blockingUserId === entry.userId}
                              disabled={
                                isUserBlocked ||
                                Boolean(blockingUserId && blockingUserId !== entry.userId) ||
                                !rosterActionsEnabled
                              }
                            />
                          </View>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={{ color: palette.subtext, marginTop: 12 }}>No booking activity yet.</Text>
          )}
          <View style={{ marginTop: 16 }}>
            <KISButton title="Close" size="sm" onPress={() => setRosterModalOpen(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={complaintOpen} transparent animationType="slide">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setComplaintOpen(false)}>
          <View style={{ flex: 1 }} />
        </Pressable>
        <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '80%' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>Dispute booking</Text>
          <Text style={{ color: palette.subtext, marginTop: 4 }}>Send your receipt, statement, and reason so KCNI can review.</Text>
          <KISTextInput
            label="Receipt link"
            value={complaintData.receiptUrl}
            onChangeText={(text) => setComplaintData((prev) => ({ ...prev, receiptUrl: text }))}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <KISButton
            title={uploadingReceipt ? 'Uploading…' : 'Upload receipt'}
            variant="outline"
            size="xs"
            onPress={handleUploadReceipt}
            disabled={uploadingReceipt}
          />
          <KISTextInput
            label="Personal statement"
            value={complaintData.personalStatement}
            onChangeText={(text) => setComplaintData((prev) => ({ ...prev, personalStatement: text }))}
            multiline
            numberOfLines={3}
          />
          <KISTextInput
            label="Reason for dissatisfaction"
            value={complaintData.reason}
            onChangeText={(text) => setComplaintData((prev) => ({ ...prev, reason: text }))}
            multiline
            numberOfLines={3}
          />
          <KISButton
            title="Submit complaint"
            onPress={handleSubmitComplaint}
            loading={submittingComplaint}
          />
        </View>
      </Modal>

      <Modal visible={rescheduleOpen} transparent animationType="slide" onRequestClose={() => setRescheduleOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setRescheduleOpen(false)}>
          <View style={{ flex: 1 }} />
        </Pressable>
        <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '85%' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>Reschedule booking</Text>
          <Text style={{ color: palette.subtext, marginTop: 4 }}>
            Choose a new date and time that fits the service availability rules.
          </Text>
          {availabilityRangeLabel ? (
            <Text style={{ color: palette.subtext, marginTop: 8, fontSize: 12 }}>
              Schedule window: {availabilityRangeLabel}
            </Text>
          ) : null}
          <ScrollView style={{ maxHeight: 220, marginTop: 12 }}>
            {dateOptions.length ? (
              dateOptions.map((date) => (
                <Pressable
                  key={date.toISOString()}
                  style={{
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.divider,
                  }}
                  onPress={() => setRescheduleDate(date)}
                >
                  <Text
                    style={{
                      color:
                        rescheduleDate?.toDateString() === date.toDateString()
                          ? palette.primaryStrong
                          : palette.text,
                      fontWeight:
                        rescheduleDate?.toDateString() === date.toDateString() ? '600' : '400',
                    }}
                  >
                    {date.toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={{ color: palette.subtext }}>No valid dates available.</Text>
            )}
          </ScrollView>
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: palette.text, marginBottom: 8 }}>Choose a time</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {availableSlots.length ? (
                availableSlots.map((slot) => {
                  const isActive = slot.enabled && slot.time === rescheduleTime;
                  return (
                    <Pressable
                      key={slot.time}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isActive ? palette.primaryStrong : palette.divider,
                        backgroundColor: isActive ? `${palette.primaryStrong}20` : palette.surface,
                        marginBottom: 4,
                        opacity: slot.enabled ? 1 : 0.35,
                      }}
                      onPress={() => slot.enabled && setRescheduleTime(slot.time)}
                    >
                      <Text
                        style={{
                          color: slot.enabled ? (isActive ? palette.primaryStrong : palette.text) : palette.subtext,
                          fontSize: 12,
                        }}
                      >
                        {slot.time}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={{ color: palette.subtext }}>No time slots available for this day.</Text>
              )}
            </View>
          </View>
          {rescheduleError ? (
            <Text style={{ color: palette.warning, marginTop: 12 }}>{rescheduleError}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <KISButton title="Close" variant="ghost" onPress={() => setRescheduleOpen(false)} />
            <KISButton
              title="Confirm reschedule"
              onPress={handleRescheduleBooking}
              loading={rescheduleLoading}
              disabled={!selectedRescheduleSlot || rescheduleLoading}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ServiceBookingDetailsPage;
