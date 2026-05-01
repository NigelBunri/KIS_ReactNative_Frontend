import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  DeviceEventEmitter,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import type { RootStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import { backendCentsToFrontendKisc, formatKiscAmount } from '@/utils/currency';
import {
  createDefaultAvailability,
  formatDateKey,
  getDayKey,
  normalizeAvailabilityPayload,
  ServiceAvailability,
} from './availabilityUtils';

type ServiceBookingRouteProp = RouteProp<RootStackParamList, 'ServiceBooking'>;

const FLOW_STEP = {
  SELECT_SLOT: 0,
  REVIEW: 1,
  SUCCESS: 2,
} as const;

const formatMoneyLabel = (value: number) => formatKiscAmount(value);

const TIME_SLOT_START_HOUR = 8;
const TIME_SLOT_END_HOUR = 20;
const TIME_SLOT_STEP_MINUTES = 30;
const DEFAULT_DATE_WINDOW = 21;
const MAX_RANGE_OPTIONS = 366;

const generateTimeline = (slotDurationMinutes: number) => {
  const duration = Math.max(5, slotDurationMinutes || TIME_SLOT_STEP_MINUTES);
  const steps = Math.floor(
    ((TIME_SLOT_END_HOUR - TIME_SLOT_START_HOUR) * 60) / duration,
  );
  const slots: string[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const totalMinutes = TIME_SLOT_START_HOUR * 60 + index * duration;
    if (totalMinutes > TIME_SLOT_END_HOUR * 60) break;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    slots.push(
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    );
  }
  return slots;
};

const normalizeDateKey = (value: Date | string) => {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
};

const parseDateOnly = (value?: string | null) => {
  if (!value) return null;
  const parts = value.split('-').map(part => Number(part));
  if (parts.length !== 3 || parts.some(segment => !Number.isFinite(segment)))
    return null;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatAvailabilityRangeLabel = (
  range?: ServiceAvailability['date_range'],
) => {
  if (!range) return '';
  const start = parseDateOnly(range.start_date);
  const end = parseDateOnly(range.end_date);
  if (!start || !end) return '';
  const startLabel = start.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
  const endLabel = end.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
  if (startLabel === endLabel) {
    return startLabel;
  }
  return `${startLabel} – ${endLabel}`;
};

const isDateWithinRange = (
  date: Date,
  range?: ServiceAvailability['date_range'],
) => {
  if (!range) return true;
  const start = parseDateOnly(range.start_date);
  const end = parseDateOnly(range.end_date);
  if (!start || !end) return true;
  const candidate = new Date(date);
  candidate.setHours(0, 0, 0, 0);
  return (
    candidate.getTime() >= start.getTime() &&
    candidate.getTime() <= end.getTime()
  );
};

const buildDateOptions = (service: any, availability: ServiceAvailability) => {
  if (!service) return [];
  const now = new Date();
  const minNoticeHours = Math.max(0, Number(service?.min_notice_hours ?? 24));
  const earliest = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
  const maxAdvanceDays = Number(service?.max_advance_booking_days ?? 30);
  const windowDays = Math.min(
    Math.max(maxAdvanceDays > 0 ? maxAdvanceDays : 30, 3),
    90,
  );
  const blackoutDates = Array.isArray(service?.blackout_dates)
    ? service.blackout_dates
    : [];
  const blackoutSet = new Set(
    blackoutDates.map((item: any) => normalizeDateKey(item)),
  );
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
  const startBoundary =
    rangeStart && rangeStart.getTime() > earliestBoundary.getTime()
      ? rangeStart
      : earliestBoundary;
  const proposedEnd = rangeEnd ? new Date(rangeEnd) : new Date(latestAllowed);
  proposedEnd.setHours(23, 59, 59, 999);
  const endBoundary = new Date(
    Math.min(proposedEnd.getTime(), latestAllowed.getTime()),
  );
  const maxOptions = availability.date_range
    ? MAX_RANGE_OPTIONS
    : DEFAULT_DATE_WINDOW;
  if (endBoundary.getTime() < startBoundary.getTime()) {
    return [];
  }
  const options: Date[] = [];
  const cursor = new Date(startBoundary);
  while (
    cursor.getTime() <= endBoundary.getTime() &&
    options.length < Math.max(maxOptions, 1)
  ) {
    if (
      cursor.getTime() > now.getTime() &&
      isDateWithinRange(cursor, availability.date_range)
    ) {
      const key = normalizeDateKey(cursor);
      if (!blackoutSet.has(key)) {
        const specificSlot = availability.specific_dates[key];
        const weeklySlot = availability.days[getDayKey(cursor)];
        const entry = specificSlot || weeklySlot;
        if (entry?.enabled) {
          options.push(new Date(cursor));
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (!options.length) {
    earliest.setMinutes(0, 0, 0);
    options.push(earliest);
  }
  if (!options.length) {
    earliest.setMinutes(0, 0, 0);
    options.push(earliest);
  }
  return options;
};

const formatSlotLabel = (value: Date) =>
  value.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const getAvailabilityEntry = (
  date: Date,
  availability: ServiceAvailability,
) => {
  const key = formatDateKey(date);
  return availability.specific_dates[key] ?? availability.days[getDayKey(date)];
};

type SlotToken = {
  time: string;
  enabled: boolean;
  reason: 'day_disabled' | 'not_in_schedule';
};

const buildSlotsForDate = (
  date: Date | null,
  availability: ServiceAvailability,
): SlotToken[] => {
  if (!date) return [];
  const entry = getAvailabilityEntry(date, availability);
  if (!entry) return [];
  const timeline = generateTimeline(availability.slot_duration_minutes);
  const allDayMode = entry.all_day;
  const allowedTimes = allDayMode ? new Set(timeline) : new Set(entry.times);
  return timeline.map(time => {
    const timeAllowed = allDayMode || allowedTimes.has(time);
    const slotEnabled = entry.enabled && timeAllowed;
    return {
      time,
      enabled: slotEnabled,
      reason: entry.enabled ? 'not_in_schedule' : 'day_disabled',
    };
  });
};

const formatList = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value))
    return value.filter(Boolean).map(item => String(item));
  return [String(value)];
};

const sanitizeDecimalInput = (value: string) => value.replace(/[^0-9.]/g, '');
const sanitizeIntegerInput = (value: string) => value.replace(/[^0-9]/g, '');
const normalizeServiceOptionList = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(item => item && typeof item === 'object')
    : [];
const extractRequirementLabel = (entry: any) =>
  String(entry?.label ?? entry?.name ?? '').trim();
const extractOptionName = (entry: any) => String(entry?.name ?? '').trim();
const extractOptionPrice = (entry: any) => Number(entry?.price ?? 0);

const SectionCard = ({
  title,
  children,
  palette,
}: {
  title: string;
  children: React.ReactNode;
  palette: ReturnType<typeof useKISTheme>['palette'];
}) => (
  <View
    style={{
      backgroundColor: palette.surfaceElevated,
      borderRadius: 20,
      padding: 16,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 5,
      gap: 10,
    }}
  >
    <Text
      style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 16 }}
    >
      {title}
    </Text>
    {children}
  </View>
);

const ServiceBookingScreen = () => {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const route = useRoute<ServiceBookingRouteProp>();
  const { serviceId, serviceName } = route.params ?? {};
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [flowStep, setFlowStep] = useState<
    (typeof FLOW_STEP)[keyof typeof FLOW_STEP]
  >(FLOW_STEP.SELECT_SLOT);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availability, setAvailability] = useState<ServiceAvailability>(() =>
    createDefaultAvailability({ timezone: 'UTC' }),
  );
  const [slotModalVisible, setSlotModalVisible] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [requestedPrice, setRequestedPrice] = useState('');
  const [participantCount, setParticipantCount] = useState('');
  const [staffOnSite, setStaffOnSite] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [remoteRegion, setRemoteRegion] = useState('');
  const [isRemote, setIsRemote] = useState(false);
  const [acknowledgedRequirements, setAcknowledgedRequirements] = useState<
    string[]
  >([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<any>(null);

  const dateOptions = useMemo(
    () => buildDateOptions(service, availability),
    [service, availability],
  );
  const availableSlots = useMemo(
    () => buildSlotsForDate(selectedDate, availability),
    [selectedDate, availability],
  );
  const selectedEntry = selectedDate
    ? getAvailabilityEntry(selectedDate, availability)
    : null;
  const availabilityRangeLabel = useMemo(
    () => formatAvailabilityRangeLabel(availability.date_range),
    [availability.date_range],
  );
  const packageOptions = useMemo(
    () => normalizeServiceOptionList(service?.packages),
    [service?.packages],
  );
  const addonOptions = useMemo(
    () => normalizeServiceOptionList(service?.addons),
    [service?.addons],
  );
  const requirementOptions = useMemo(
    () => normalizeServiceOptionList(service?.requirements),
    [service?.requirements],
  );
  const serviceDeliveryModes = service?.delivery_modes;
  const remoteSupported = useMemo(
    () =>
      Array.isArray(serviceDeliveryModes) &&
      serviceDeliveryModes.some(
        (mode: string) => String(mode).toLowerCase() === 'remote',
      ),
    [serviceDeliveryModes],
  );
  const quoteOrNegotiationFlow = Boolean(
    service?.quote_required || service?.negotiable,
  );
  const participantFieldsVisible =
    Number(service?.max_participants ?? 0) > 1 ||
    Number(service?.staff_required ?? 0) > 0;
  const requiresAdvancedOptions = Boolean(
    service?.quote_required ||
      requirementOptions.length ||
      service?.service_terms,
  );
  const hasAdvancedOptions = Boolean(
    packageOptions.length ||
      addonOptions.length ||
      quoteOrNegotiationFlow ||
      participantFieldsVisible ||
      remoteSupported ||
      requirementOptions.length ||
      service?.service_terms,
  );

  useEffect(() => {
    if (!availableSlots.length) {
      setSelectedTime(null);
      return;
    }
    setSelectedTime(prev => {
      if (prev) {
        const keep = availableSlots.find(
          slot => slot.time === prev && slot.enabled,
        );
        if (keep) return prev;
      }
      const next = availableSlots.find(slot => slot.enabled);
      return next?.time ?? availableSlots[0].time;
    });
  }, [availableSlots]);

  const selectedSlot = useMemo(() => {
    if (!selectedDate || !selectedTime) return null;
    const [hour, minute] = selectedTime.split(':').map(Number);
    const slot = new Date(selectedDate);
    slot.setHours(hour, minute, 0, 0);
    return slot;
  }, [selectedDate, selectedTime]);

  useEffect(() => {
    const fetchService = async () => {
      if (!serviceId) return;
      setLoading(true);
      try {
        const response = await getRequest(
          ROUTES.commerce.shopService(serviceId),
          {
            errorMessage: 'Unable to load service details.',
          },
        );
        if (response?.success && response.data) {
          setService(response.data);
          setAvailability(
            normalizeAvailabilityPayload(response.data?.availability),
          );
        }
      } catch (error: any) {
        Alert.alert(
          'Service booking',
          error?.message || 'Unable to fetch service details.',
        );
      } finally {
        setLoading(false);
      }
    };
    fetchService();
  }, [serviceId]);

  useEffect(() => {
    if (!service) {
      setAvailability(createDefaultAvailability({ timezone: 'UTC' }));
    }
  }, [service]);

  useEffect(() => {
    setSelectedPackage('');
    setSelectedAddons([]);
    setRequestedPrice('');
    setParticipantCount('');
    setStaffOnSite('');
    setLocationAddress('');
    setLocationCity('');
    setLocationState('');
    setLocationCountry('');
    setRemoteRegion('');
    setAcknowledgedRequirements([]);
    setTermsAccepted(false);
    setShowAdvancedOptions(requiresAdvancedOptions);
    setIsRemote(
      remoteSupported &&
        !(
          Array.isArray(serviceDeliveryModes) &&
          serviceDeliveryModes.includes('onsite')
        ),
    );
  }, [
    service?.id,
    serviceDeliveryModes,
    remoteSupported,
    requiresAdvancedOptions,
  ]);

  useEffect(() => {
    if (!dateOptions.length) return;
    setSelectedDate(prev => {
      if (prev) {
        const match = dateOptions.find(
          option => option.toDateString() === prev.toDateString(),
        );
        if (match) return match;
      }
      return dateOptions[0];
    });
  }, [dateOptions]);

  const basePriceValue = useMemo(() => {
    const value = Number(service?.price ?? 0);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }, [service?.price]);

  const selectedPackageValue = useMemo(() => {
    if (!selectedPackage) return 0;
    const entry = packageOptions.find(
      (item: any) => extractOptionName(item) === selectedPackage,
    );
    const value = extractOptionPrice(entry);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }, [packageOptions, selectedPackage]);

  const selectedAddonsValue = useMemo(
    () =>
      addonOptions.reduce((total: number, addon: any) => {
        const name = extractOptionName(addon);
        if (!name || !selectedAddons.includes(name)) return total;
        const value = extractOptionPrice(addon);
        return total + (Number.isFinite(value) ? Math.max(0, value) : 0);
      }, 0),
    [addonOptions, selectedAddons],
  );

  const requestedPriceValue = useMemo(() => {
    const value = Number(requestedPrice.trim());
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }, [requestedPrice]);
  const requestedPriceTrimmed = useMemo(
    () => requestedPrice.trim(),
    [requestedPrice],
  );

  const estimatedTotalValue = useMemo(() => {
    if (service?.negotiable && requestedPriceTrimmed) {
      return requestedPriceValue;
    }
    const minimumCharge = Number(service?.minimum_charge ?? 0);
    const rawTotal =
      basePriceValue + selectedPackageValue + selectedAddonsValue;
    if (Number.isFinite(minimumCharge) && minimumCharge > 0) {
      return Math.max(rawTotal, minimumCharge);
    }
    return rawTotal;
  }, [
    basePriceValue,
    requestedPriceTrimmed,
    requestedPriceValue,
    selectedAddonsValue,
    selectedPackageValue,
    service?.minimum_charge,
    service?.negotiable,
  ]);

  const estimatedDepositValue = useMemo(() => {
    if (quoteOrNegotiationFlow) return 0;
    if (estimatedTotalValue <= 0) return 0;
    const amount = Number(service?.deposit_amount ?? '');
    const percent = Number(service?.deposit_percent ?? '');
    let depositValue = Number.isFinite(amount) && amount > 0 ? amount : 0;
    if (!depositValue && Number.isFinite(percent) && percent > 0) {
      depositValue = estimatedTotalValue * (percent / 100);
    }
    if (!depositValue) {
      depositValue = estimatedTotalValue;
    }
    return (
      Math.min(estimatedTotalValue, Math.max(0, depositValue)) ||
      estimatedTotalValue
    );
  }, [
    estimatedTotalValue,
    quoteOrNegotiationFlow,
    service?.deposit_amount,
    service?.deposit_percent,
  ]);

  const estimatedBalanceValue = Math.max(
    estimatedTotalValue - estimatedDepositValue,
    0,
  );

  const summaryList = useMemo(() => {
    const details: Array<{ label: string; value?: string }> = [];
    if (service?.catalog_categories?.[0]?.name) {
      details.push({
        label: 'Category',
        value: service.catalog_categories[0].name,
      });
    }
    if (service?.service_type) {
      details.push({ label: 'Type', value: service.service_type });
    }
    if (service?.delivery_modes?.length) {
      details.push({
        label: 'Delivery',
        value: service.delivery_modes.join(', '),
      });
    }
    if (service?.visibility) {
      details.push({ label: 'Visibility', value: service.visibility });
    }
    if (service?.status) {
      details.push({ label: 'Status', value: service.status });
    }
    if (service?.duration_minutes) {
      details.push({
        label: 'Duration',
        value: `${service.duration_minutes} min`,
      });
    }
    if (service?.staff_required) {
      details.push({
        label: 'Staff',
        value: `${service.staff_required} required`,
      });
    }
    return details;
  }, [service]);

  const availabilityRules = useMemo(() => {
    if (!Array.isArray(service?.availability_rules)) return [] as string[];
    return service.availability_rules.map((rule: any) => {
      const scope = String(rule.scope ?? 'Day').toUpperCase();
      const targets = formatList(rule.targets).join(', ') || 'Any';
      const times = formatList(rule.times).join(', ') || 'Any';
      return `${scope} • ${targets} @ ${times}`;
    });
  }, [service?.availability_rules]);

  const badges = useMemo(() => {
    const base: string[] = [];
    base.push(service?.is_active ? 'Active' : 'Inactive');
    if (service?.visibility) {
      base.push(service.visibility);
    }
    if (service?.status) {
      base.push(service.status);
    }
    if (service?.is_featured) {
      base.push('Featured');
    }
    return base;
  }, [service]);

  const renderListItems = (items: string[]) =>
    items.map(item => (
      <Text key={item} style={{ color: palette.text, fontSize: 13 }}>
        {item}
      </Text>
    ));

  const toggleAddon = (name: string) => {
    setSelectedAddons(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name],
    );
  };

  const toggleRequirement = (label: string) => {
    setAcknowledgedRequirements(prev =>
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label],
    );
  };

  const handleProceedToReview = () => {
    if (!selectedSlot) {
      setBookingError('Please select a date and time.');
      return;
    }
    if (requirementOptions.length) {
      const missing = requirementOptions
        .map(extractRequirementLabel)
        .filter(Boolean)
        .filter(label => !acknowledgedRequirements.includes(label));
      if (missing.length) {
        setBookingError(
          'Please acknowledge all service requirements before continuing.',
        );
        return;
      }
    }
    if (service?.service_terms && !termsAccepted) {
      setBookingError('Please accept the service terms before continuing.');
      return;
    }
    setBookingError(null);
    setFlowStep(FLOW_STEP.REVIEW);
  };

  const handleConfirmBooking = useCallback(async () => {
    if (bookingLoading || !service?.id || !selectedSlot) return;
    setBookingLoading(true);
    setBookingError(null);
    try {
      const payload: Record<string, unknown> = {
        service_id: service.id,
        scheduled_at: selectedSlot.toISOString(),
        instructions: instructions.trim(),
      };
      if (selectedPackage) {
        payload.selected_package = selectedPackage;
      }
      if (selectedAddons.length) {
        payload.selected_addons = selectedAddons;
      }
      if (quoteOrNegotiationFlow && requestedPriceTrimmed) {
        payload.requested_price = requestedPriceTrimmed;
      }
      if (participantCount.trim()) {
        payload.participant_count = Number(participantCount);
      }
      if (staffOnSite.trim()) {
        payload.staff_on_site = Number(staffOnSite);
      }
      if (acknowledgedRequirements.length) {
        payload.requirements_acknowledged = acknowledgedRequirements;
      }
      if (service?.service_terms) {
        payload.terms_accepted = termsAccepted;
      }
      if (remoteSupported) {
        payload.is_remote = isRemote;
        if (isRemote && remoteRegion.trim()) {
          payload.remote_region = remoteRegion.trim();
        }
      }
      if (!isRemote) {
        const location: Record<string, string> = {};
        if (locationAddress.trim())
          location.address_line1 = locationAddress.trim();
        if (locationCity.trim()) location.city = locationCity.trim();
        if (locationState.trim()) location.state = locationState.trim();
        if (locationCountry.trim()) location.country = locationCountry.trim();
        if (Object.keys(location).length) {
          payload.location = location;
        }
      }
      const response = await postRequest(
        ROUTES.commerce.serviceBookings,
        payload,
        {
          errorMessage: 'Unable to confirm booking.',
        },
      );
      if (response?.success === false) {
        const detailMessage =
          response?.data?.detail ||
          response?.message ||
          'Unable to confirm booking.';
        const conflict =
          response?.status === 409 ||
          detailMessage.toLowerCase().includes('already been booked');
        const statusMessage = conflict
          ? 'Selected slot is no longer available.'
          : detailMessage;
        throw new Error(statusMessage);
      }
      setBookingResult(response?.data ?? response);
      DeviceEventEmitter.emit('service-booking.refresh', {
        serviceId: String(service.id),
        booking: response?.data ?? response,
      });
      setFlowStep(FLOW_STEP.SUCCESS);
    } catch (error: any) {
      const message = error?.message || 'Unable to confirm booking.';
      setBookingError(message);
    } finally {
      setBookingLoading(false);
    }
  }, [
    acknowledgedRequirements,
    bookingLoading,
    instructions,
    isRemote,
    locationAddress,
    locationCity,
    locationCountry,
    locationState,
    participantCount,
    quoteOrNegotiationFlow,
    remoteRegion,
    remoteSupported,
    requestedPriceTrimmed,
    selectedAddons,
    selectedPackage,
    selectedSlot,
    service?.id,
    service?.service_terms,
    staffOnSite,
    termsAccepted,
  ]);

  const renderStepContent = () => {
    if (flowStep === FLOW_STEP.SELECT_SLOT) {
      return (
        <View style={{ gap: 12 }}>
          <View>
            <Text style={{ color: palette.text, marginBottom: 4 }}>
              Selected slot
            </Text>
            <Pressable
              style={{
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: palette.divider,
                backgroundColor: palette.surface,
              }}
              onPress={() => setSlotModalVisible(true)}
            >
              <Text style={{ color: palette.text, fontWeight: '600' }}>
                {selectedSlot
                  ? formatSlotLabel(selectedSlot)
                  : 'Tap to select a date & time'}
              </Text>
              <Text
                style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}
              >
                Availability is verified by the shop and subject to its
                scheduling rules.
              </Text>
            </Pressable>
          </View>
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            We only expose dates that respect the shop's notice, blackout, and
            advance booking windows.
          </Text>
          <KISTextInput
            label="Instructions"
            placeholder="Share any special requests"
            value={instructions}
            onChangeText={setInstructions}
            multiline
          />
          {hasAdvancedOptions ? (
            <View
              style={{
                gap: 12,
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 16,
                padding: 12,
                backgroundColor: palette.surface,
              }}
            >
              <Pressable
                onPress={() => setShowAdvancedOptions(prev => !prev)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: palette.text, fontWeight: '700' }}>
                    {requiresAdvancedOptions
                      ? 'Required booking details'
                      : 'More booking options'}
                  </Text>
                  <Text
                    style={{
                      color: palette.subtext,
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {requiresAdvancedOptions
                      ? 'Complete the required service-specific details before review.'
                      : 'Add package, add-on, quote, delivery, or other optional details only if needed.'}
                  </Text>
                </View>
                <Text
                  style={{ color: palette.primaryStrong, fontWeight: '700' }}
                >
                  {showAdvancedOptions ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
              {showAdvancedOptions ? (
                <View style={{ gap: 12 }}>
                  {packageOptions.length ? (
                    <View style={{ gap: 8 }}>
                      <Text style={{ color: palette.text, fontWeight: '600' }}>
                        Choose a package
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        {packageOptions.map((pkg: any) => {
                          const name = extractOptionName(pkg);
                          if (!name) return null;
                          const active = selectedPackage === name;
                          return (
                            <Pressable
                              key={name}
                              onPress={() =>
                                setSelectedPackage(active ? '' : name)
                              }
                              style={{
                                paddingVertical: 8,
                                paddingHorizontal: 10,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: active
                                  ? palette.primaryStrong
                                  : palette.divider,
                                backgroundColor: active
                                  ? `${palette.primaryStrong}18`
                                  : palette.surface,
                              }}
                            >
                              <Text
                                style={{
                                  color: active
                                    ? palette.primaryStrong
                                    : palette.text,
                                  fontWeight: '600',
                                }}
                              >
                                {name}{' '}
                                {extractOptionPrice(pkg)
                                  ? `· ${extractOptionPrice(pkg).toFixed(
                                      2,
                                    )} KISC`
                                  : ''}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                  {addonOptions.length ? (
                    <View style={{ gap: 8 }}>
                      <Text style={{ color: palette.text, fontWeight: '600' }}>
                        Optional add-ons
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        {addonOptions.map((addon: any) => {
                          const name = extractOptionName(addon);
                          if (!name) return null;
                          const active = selectedAddons.includes(name);
                          return (
                            <Pressable
                              key={name}
                              onPress={() => toggleAddon(name)}
                              style={{
                                paddingVertical: 8,
                                paddingHorizontal: 10,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: active
                                  ? palette.primaryStrong
                                  : palette.divider,
                                backgroundColor: active
                                  ? `${palette.primaryStrong}18`
                                  : palette.surface,
                              }}
                            >
                              <Text
                                style={{
                                  color: active
                                    ? palette.primaryStrong
                                    : palette.text,
                                }}
                              >
                                {name}{' '}
                                {extractOptionPrice(addon)
                                  ? `· ${extractOptionPrice(addon).toFixed(
                                      2,
                                    )} KISC`
                                  : ''}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                  {quoteOrNegotiationFlow ? (
                    <KISTextInput
                      label={
                        service?.quote_required
                          ? 'Requested price / quote'
                          : 'Your proposed price'
                      }
                      placeholder="Enter your proposed amount"
                      value={requestedPrice}
                      onChangeText={value =>
                        setRequestedPrice(sanitizeDecimalInput(value))
                      }
                      keyboardType="numeric"
                    />
                  ) : null}
                  {participantFieldsVisible ? (
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <KISTextInput
                          label="Participants"
                          value={participantCount}
                          onChangeText={value =>
                            setParticipantCount(sanitizeIntegerInput(value))
                          }
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <KISTextInput
                          label="Staff on site"
                          value={staffOnSite}
                          onChangeText={value =>
                            setStaffOnSite(sanitizeIntegerInput(value))
                          }
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  ) : null}
                  {remoteSupported ? (
                    <View style={{ gap: 8 }}>
                      <Text style={{ color: palette.text, fontWeight: '600' }}>
                        Delivery mode
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {[
                          { key: false, label: 'On-site' },
                          { key: true, label: 'Remote' },
                        ].map(option => (
                          <Pressable
                            key={String(option.key)}
                            onPress={() => setIsRemote(option.key)}
                            style={{
                              paddingVertical: 8,
                              paddingHorizontal: 10,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor:
                                isRemote === option.key
                                  ? palette.primaryStrong
                                  : palette.divider,
                              backgroundColor:
                                isRemote === option.key
                                  ? `${palette.primaryStrong}18`
                                  : palette.surface,
                            }}
                          >
                            <Text
                              style={{
                                color:
                                  isRemote === option.key
                                    ? palette.primaryStrong
                                    : palette.text,
                              }}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  {remoteSupported ? (
                    isRemote ? (
                      <KISTextInput
                        label="Remote region"
                        placeholder="Enter your region"
                        value={remoteRegion}
                        onChangeText={setRemoteRegion}
                      />
                    ) : (
                      <View style={{ gap: 8 }}>
                        <KISTextInput
                          label="Location address"
                          value={locationAddress}
                          onChangeText={setLocationAddress}
                        />
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <KISTextInput
                              label="City"
                              value={locationCity}
                              onChangeText={setLocationCity}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <KISTextInput
                              label="State"
                              value={locationState}
                              onChangeText={setLocationState}
                            />
                          </View>
                        </View>
                        <KISTextInput
                          label="Country"
                          value={locationCountry}
                          onChangeText={setLocationCountry}
                        />
                      </View>
                    )
                  ) : null}
                  {requirementOptions.length ? (
                    <View style={{ gap: 8 }}>
                      <Text style={{ color: palette.text, fontWeight: '600' }}>
                        Requirements acknowledgement
                      </Text>
                      {requirementOptions.map((entry: any) => {
                        const label = extractRequirementLabel(entry);
                        if (!label) return null;
                        const active = acknowledgedRequirements.includes(label);
                        return (
                          <Pressable
                            key={label}
                            onPress={() => toggleRequirement(label)}
                            style={{
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: active
                                ? palette.primaryStrong
                                : palette.divider,
                              backgroundColor: active
                                ? `${palette.primaryStrong}12`
                                : palette.surface,
                            }}
                          >
                            <Text
                              style={{
                                color: active
                                  ? palette.primaryStrong
                                  : palette.text,
                              }}
                            >
                              {active ? 'Accepted' : 'Tap to accept'} · {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                  {service?.service_terms ? (
                    <Pressable
                      onPress={() => setTermsAccepted(prev => !prev)}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: termsAccepted
                          ? palette.primaryStrong
                          : palette.divider,
                        backgroundColor: termsAccepted
                          ? `${palette.primaryStrong}12`
                          : palette.surface,
                      }}
                    >
                      <Text
                        style={{
                          color: palette.text,
                          fontWeight: '600',
                          marginBottom: 6,
                        }}
                      >
                        Service terms
                      </Text>
                      <Text style={{ color: palette.subtext, fontSize: 12 }}>
                        {service.service_terms}
                      </Text>
                      <Text
                        style={{
                          color: termsAccepted
                            ? palette.primaryStrong
                            : palette.text,
                          marginTop: 8,
                        }}
                      >
                        {termsAccepted
                          ? 'Terms accepted'
                          : 'Tap to accept terms'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
          {bookingError ? (
            <Text style={{ color: palette.primaryStrong, fontSize: 13 }}>
              {bookingError}
            </Text>
          ) : null}
          <KISButton title="Review booking" onPress={handleProceedToReview} />
        </View>
      );
    }
    if (flowStep === FLOW_STEP.REVIEW) {
      return (
        <View style={{ gap: 12 }}>
          <SectionCard title="Booking review" palette={palette}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: palette.subtext }}>Service</Text>
              <Text style={{ color: palette.text }}>
                {service?.name ?? serviceName}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: palette.subtext }}>Scheduled</Text>
              <Text style={{ color: palette.text }}>
                {selectedSlot ? formatSlotLabel(selectedSlot) : 'N/A'}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: palette.subtext }}>Total price</Text>
              <Text style={{ color: palette.text }}>
                {formatMoneyLabel(estimatedTotalValue)}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: palette.subtext }}>
                {quoteOrNegotiationFlow ? 'Due now' : 'Deposit (wallet)'}
              </Text>
              <Text style={{ color: palette.text }}>
                {formatMoneyLabel(estimatedDepositValue)}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: palette.subtext }}>Remaining</Text>
              <Text style={{ color: palette.text }}>
                {formatMoneyLabel(estimatedBalanceValue)}
              </Text>
            </View>
            {instructions ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: palette.subtext, marginBottom: 4 }}>
                  Instructions
                </Text>
                <Text style={{ color: palette.text }}>{instructions}</Text>
              </View>
            ) : null}
            {selectedPackage ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: palette.subtext, marginBottom: 4 }}>
                  Package
                </Text>
                <Text style={{ color: palette.text }}>{selectedPackage}</Text>
              </View>
            ) : null}
            {selectedAddons.length ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: palette.subtext, marginBottom: 4 }}>
                  Add-ons
                </Text>
                <Text style={{ color: palette.text }}>
                  {selectedAddons.join(', ')}
                </Text>
              </View>
            ) : null}
            {requestedPrice ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: palette.subtext, marginBottom: 4 }}>
                  Requested price
                </Text>
                <Text style={{ color: palette.text }}>
                  {formatMoneyLabel(requestedPriceValue)}
                </Text>
              </View>
            ) : null}
            {participantCount ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: palette.subtext, marginBottom: 4 }}>
                  Participants
                </Text>
                <Text style={{ color: palette.text }}>{participantCount}</Text>
              </View>
            ) : null}
            {staffOnSite ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: palette.subtext, marginBottom: 4 }}>
                  Staff on site
                </Text>
                <Text style={{ color: palette.text }}>{staffOnSite}</Text>
              </View>
            ) : null}
            {isRemote && remoteRegion ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: palette.subtext, marginBottom: 4 }}>
                  Remote region
                </Text>
                <Text style={{ color: palette.text }}>{remoteRegion}</Text>
              </View>
            ) : null}
            {!isRemote &&
            (locationAddress ||
              locationCity ||
              locationState ||
              locationCountry) ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: palette.subtext, marginBottom: 4 }}>
                  Location
                </Text>
                <Text style={{ color: palette.text }}>
                  {[
                    locationAddress,
                    locationCity,
                    locationState,
                    locationCountry,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </Text>
              </View>
            ) : null}
            {acknowledgedRequirements.length ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: palette.subtext, marginBottom: 4 }}>
                  Requirements acknowledged
                </Text>
                <Text style={{ color: palette.text }}>
                  {acknowledgedRequirements.join(', ')}
                </Text>
              </View>
            ) : null}
            {service?.service_terms ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: palette.subtext, marginBottom: 4 }}>
                  Terms
                </Text>
                <Text style={{ color: palette.text }}>
                  {termsAccepted ? 'Accepted' : 'Not accepted'}
                </Text>
              </View>
            ) : null}
          </SectionCard>
          {bookingError ? (
            <Text style={{ color: palette.primaryStrong, fontSize: 13 }}>
              {bookingError}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <KISButton
              title="Back"
              variant="outline"
              onPress={() => setFlowStep(FLOW_STEP.SELECT_SLOT)}
            />
            <KISButton
              title={
                quoteOrNegotiationFlow
                  ? 'Confirm request'
                  : estimatedDepositValue > 0
                  ? 'Confirm & pay'
                  : 'Confirm booking'
              }
              onPress={handleConfirmBooking}
              loading={bookingLoading}
              disabled={bookingLoading}
            />
          </View>
        </View>
      );
    }
    return (
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Text
          style={{
            color: palette.primaryStrong,
            fontSize: 20,
            fontWeight: '700',
          }}
        >
          Booking confirmed
        </Text>
        <Text style={{ color: palette.text }}>{`Reference: ${
          bookingResult?.id ?? 'N/A'
        }`}</Text>
        <Text
          style={{ color: palette.subtext, textAlign: 'center', maxWidth: 260 }}
        >
          {Number(bookingResult?.deposit_cents ?? 0) > 0
            ? `Your wallet was charged ${formatKiscAmount(
                backendCentsToFrontendKisc(bookingResult?.deposit_cents ?? 0),
              )} and the shop owner has been notified.`
            : 'Your booking request has been sent and the shop owner has been notified.'}
        </Text>
        <KISButton title="Done" onPress={() => navigation.goBack()} />
      </View>
    );
  };

  const slotModal = (
    <Modal
      transparent
      visible={slotModalVisible}
      animationType="fade"
      onRequestClose={() => setSlotModalVisible(false)}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          justifyContent: 'center',
          padding: 24,
        }}
        onPress={() => setSlotModalVisible(false)}
      >
        <Pressable
          style={{
            backgroundColor: palette.surface,
            borderRadius: 20,
            padding: 16,
            maxHeight: '80%',
          }}
        >
          <Text
            style={{
              color: palette.text,
              fontSize: 16,
              fontWeight: '600',
              marginBottom: 12,
            }}
          >
            Choose a date & time
          </Text>
          <Text
            style={{ color: palette.subtext, fontSize: 12, marginBottom: 8 }}
          >
            We respect the shop's notice, blackout, and advance booking settings
            when offering slots.
          </Text>
          {availabilityRangeLabel ? (
            <Text
              style={{ color: palette.subtext, fontSize: 12, marginBottom: 8 }}
            >
              Available window: {availabilityRangeLabel}
            </Text>
          ) : null}
          <ScrollView style={{ maxHeight: 200, marginBottom: 12 }}>
            {dateOptions.length ? (
              dateOptions.map(date => (
                <Pressable
                  key={date.toISOString()}
                  style={{
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.divider,
                  }}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text
                    style={{
                      color:
                        selectedDate?.toDateString() === date.toDateString()
                          ? palette.primaryStrong
                          : palette.text,
                      fontWeight:
                        selectedDate?.toDateString() === date.toDateString()
                          ? '600'
                          : '400',
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
              <Text style={{ color: palette.subtext }}>
                No valid dates available.
              </Text>
            )}
          </ScrollView>
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: palette.text, marginBottom: 4 }}>
              Choose a time
            </Text>
            {selectedEntry ? (
              <Text
                style={{
                  color: palette.subtext,
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                {selectedEntry.all_day
                  ? 'All-day availability: every slot for this day is open.'
                  : 'Select any of the defined time slots below.'}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {availableSlots.length ? (
                availableSlots.map(slot => {
                  const isActive = slot.enabled && slot.time === selectedTime;
                  return (
                    <Pressable
                      key={slot.time}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isActive
                          ? palette.primaryStrong
                          : palette.divider,
                        backgroundColor: isActive
                          ? `${palette.primaryStrong}20`
                          : palette.surface,
                        marginBottom: 4,
                        opacity: slot.enabled ? 1 : 0.35,
                      }}
                      onPress={() => slot.enabled && setSelectedTime(slot.time)}
                    >
                      <Text
                        style={{
                          color: slot.enabled
                            ? isActive
                              ? palette.primaryStrong
                              : palette.text
                            : palette.subtext,
                          fontSize: 12,
                        }}
                      >
                        {slot.time}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={{ color: palette.subtext, marginBottom: 4 }}>
                  No time slots available for this day.
                </Text>
              )}
            </View>
          </View>
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            We will re-validate this slot when you confirm the booking to
            prevent any conflicts.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );

  if (loading && !service) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: palette.bg,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color={palette.primaryStrong} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <SectionCard
          title={service?.name ?? serviceName ?? 'Service booking'}
          palette={palette}
        >
          <Text style={{ color: palette.text }}>
            {service?.short_summary ??
              service?.description ??
              'Booking details are shown below.'}
          </Text>
          <Text
            style={{
              color: palette.primaryStrong,
              fontSize: 28,
              fontWeight: '700',
              marginTop: 8,
            }}
          >
            {formatMoneyLabel(basePriceValue)}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 12,
            }}
          >
            {badges.map(text => (
              <View
                key={text}
                style={{
                  borderRadius: 12,
                  backgroundColor: palette.primary ?? palette.primaryStrong,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{ color: palette.onPrimary ?? '#fff', fontSize: 12 }}
                >
                  {text}
                </Text>
              </View>
            ))}
          </View>
        </SectionCard>
        <SectionCard title="Booking flow" palette={palette}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <Text style={{ color: palette.subtext }}>Step</Text>
            <Text style={{ color: palette.text, fontWeight: '700' }}>
              {flowStep === FLOW_STEP.SELECT_SLOT && 'Select slot'}
              {flowStep === FLOW_STEP.REVIEW && 'Review & confirm'}
              {flowStep === FLOW_STEP.SUCCESS && 'Booking complete'}
            </Text>
          </View>
          {buildStepIndicator(flowStep, palette)}
          {renderStepContent()}
        </SectionCard>
        <SectionCard title="Service details" palette={palette}>
          {summaryList.map(detail => (
            <View
              key={detail.label}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 2,
              }}
            >
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                {detail.label}
              </Text>
              <Text style={{ color: palette.text, fontSize: 12 }}>
                {detail.value}
              </Text>
            </View>
          ))}
        </SectionCard>
        <SectionCard title="Availability" palette={palette}>
          {availabilityRangeLabel ? (
            <Text style={{ color: palette.text, marginBottom: 6 }}>
              Schedule window: {availabilityRangeLabel}
            </Text>
          ) : null}
          {availabilityRules.length ? (
            availabilityRules.map((rule: string) => (
              <Text key={rule} style={{ color: palette.text, fontSize: 13 }}>
                {rule}
              </Text>
            ))
          ) : (
            <Text style={{ color: palette.subtext }}>
              Availability rules will be shown here.
            </Text>
          )}
        </SectionCard>
        <SectionCard title="Coverage" palette={palette}>
          {formatList(service?.coverage).length ? (
            renderListItems(formatList(service.coverage))
          ) : (
            <Text style={{ color: palette.subtext }}>
              No coverage regions defined.
            </Text>
          )}
        </SectionCard>
        <SectionCard title="Add-ons & packages" palette={palette}>
          {packageOptions.length ? (
            packageOptions.map((pkg: any) => {
              const name = extractOptionName(pkg);
              return (
                <Text key={name} style={{ color: palette.text, fontSize: 13 }}>
                  {name}{' '}
                  {extractOptionPrice(pkg)
                    ? `· ${extractOptionPrice(pkg).toFixed(2)} KISC`
                    : ''}
                </Text>
              );
            })
          ) : (
            <Text style={{ color: palette.subtext }}>No packages yet.</Text>
          )}
          {addonOptions.length ? (
            addonOptions.map((addon: any) => {
              const name = extractOptionName(addon);
              return (
                <Text key={name} style={{ color: palette.text, fontSize: 13 }}>
                  {name}{' '}
                  {extractOptionPrice(addon)
                    ? `· ${extractOptionPrice(addon).toFixed(2)} KISC`
                    : ''}
                </Text>
              );
            })
          ) : (
            <Text style={{ color: palette.subtext }}>No add-ons yet.</Text>
          )}
        </SectionCard>
        <SectionCard title="Requirements" palette={palette}>
          {requirementOptions.length ? (
            requirementOptions.map((entry: any) => {
              const label = extractRequirementLabel(entry);
              return (
                <Text key={label} style={{ color: palette.text, fontSize: 13 }}>
                  {label}
                </Text>
              );
            })
          ) : (
            <Text style={{ color: palette.subtext }}>
              No requirements specified.
            </Text>
          )}
        </SectionCard>
      </ScrollView>
      {slotModal}
    </SafeAreaView>
  );
};

const buildStepIndicator = (
  step: number,
  palette: ReturnType<typeof useKISTheme>['palette'],
) => (
  <View
    style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    }}
  >
    {[FLOW_STEP.SELECT_SLOT, FLOW_STEP.REVIEW, FLOW_STEP.SUCCESS].map(
      (id, index) => (
        <View key={id} style={{ alignItems: 'center', flex: 1 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor:
                step === id ? palette.primary : `${palette.primary}20`,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {index + 1}
            </Text>
          </View>
          <Text
            style={{
              color: palette.subtext,
              fontSize: 11,
              marginTop: 4,
              textAlign: 'center',
            }}
          >
            {id === FLOW_STEP.SELECT_SLOT && 'Select slot'}
            {id === FLOW_STEP.REVIEW && 'Review & pay'}
            {id === FLOW_STEP.SUCCESS && 'Success'}
          </Text>
        </View>
      ),
    )}
  </View>
);

export default ServiceBookingScreen;
