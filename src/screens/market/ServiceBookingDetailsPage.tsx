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

const formatKisc = (value: number | null | undefined) => {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${(safe / 100).toFixed(2)} KISC`;
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

const CANCELLATION_WINDOW_MS = 2 * 60 * 60 * 1000;

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
  const [receiptLinks, setReceiptLinks] = useState<{ pdf?: string; page?: string }>({});
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [completingPayment, setCompletingPayment] = useState(false);
  const cachedUserProfile = useMemo(
    () => cachedStorageUser?.user ?? cachedStorageUser ?? null,
    [cachedStorageUser],
  );
  const currentUserId = cachedUserProfile?.id ?? cachedUserProfile?.user_id ?? cachedUserProfile?.uuid ?? null;
  const serviceId = useMemo(() => getServiceIdentifier(booking), [booking]);
  console.log("booking data: ", booking)
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
      console.log('ServiceBookingDetailsPage shopMembers response for shopId', shopId, response);
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
    if (shopId) {
      console.log('ServiceBookingDetailsPage loading shopMembers for shopId', shopId);
    }
    void loadShopMembers();
  }, [loadShopMembers, shopId]);

  const isProvider = useMemo(() => {
    if (!booking || !currentUserId) return false;
    const providerId = booking?.provider_details?.id;
    return providerId && String(providerId) === String(currentUserId);
  }, [booking, currentUserId]);
  const isPayer = useMemo(() => {
    if (!booking || !currentUserId) return false;
    return String(booking?.user) === String(currentUserId);
  }, [booking, currentUserId]);

   console.log("see the shope members now", shopMembers)
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
  console.log("now checking for the resent buttons: ", canManageRosterActions, "see now", isShopTeamMember)
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
        records.forEach((item) => {
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
        const filtered = records.filter((entry) => getServiceIdentifier(entry) === serviceId);
        if (booking && !filtered.some((entry) => String(entry?.id) === String(booking?.id))) {
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
  const scheduledMs = scheduledAt?.getTime() ?? null;
  const cancellationWindowMs = CANCELLATION_WINDOW_MS;
  const isScheduledInFuture = scheduledMs ? scheduledMs > currentTime : false;
  const meetsNoticeWindow = scheduledMs ? scheduledMs - currentTime >= cancellationWindowMs : false;
  const cancellableStatuses = ['pending', 'confirmed'];
  const hasCancellableStatus = cancellableStatuses.includes(booking?.status ?? '');
  const canCancelBooking = Boolean(isPayer && hasCancellableStatus && isScheduledInFuture && meetsNoticeWindow);
  const cancellationDisabledReason = useMemo(() => {
    if (!isPayer) return null;
    if (!hasCancellableStatus) return 'Only pending or confirmed bookings can be canceled.';
    if (!scheduledAt) return 'Scheduled time is unavailable.';
    if (!isScheduledInFuture) return 'The service date/time has already passed.';
    if (!meetsNoticeWindow) return 'Cancel at least two hours before the scheduled time for a refund.';
    return null;
  }, [isPayer, hasCancellableStatus, scheduledAt, isScheduledInFuture, meetsNoticeWindow]);

  const handleCancelBooking = useCallback(async () => {
    if (!bookingId || !canCancelBooking) return;
    setCancelLoading(true);
    try {
      const res = await postRequest(ROUTES.commerce.serviceBookingCancel(bookingId), {});
      if (!res?.success) {
        throw new Error(res?.message || 'Unable to cancel booking.');
      }
      Alert.alert('Booking', 'Your booking is canceled and you will receive a 100% refund.');
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
      };
      if (!links.pdf && !links.page) {
        throw new Error('Booking receipt links are missing.');
      }
      setReceiptLinks(links);
      return links;
    } finally {
      setLoadingReceipt(false);
    }
  }, [bookingId]);

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
      booking?.status === 'awaiting_satisfaction' && isPayer && booking?.provider_completed_at && !booking?.payer_satisfied_at
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
                Cancel at least two hours before the scheduled time to receive a full refund.
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

        {hasPaymentReference ? (
          <View style={[cardStyle, { gap: 10 }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>Receipts</Text>
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
            <View style={{ marginTop: 12 }}>
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

        {(isProvider && paymentStatusValue === 'paid') && (
          <KISButton title="Mark Completed" onPress={handleMarkCompleted} loading={actionLoading} />
        )}
        {showComplaintPrompt && (
          <View style={{ backgroundColor: palette.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: palette.warning }}>
            <Text style={{ color: palette.text, fontWeight: '600' }}>Provider marked service as completed.</Text>
            <Text style={{ color: palette.subtext, marginVertical: 8 }}>You have 3 days to send a receipt and personal statement if the service was unsatisfactory.</Text>
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
                  typeof timeUntilScheduled === 'number' && timeUntilScheduled >= CANCELLATION_WINDOW_MS;
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
    </View>
  );
};

export default ServiceBookingDetailsPage;
