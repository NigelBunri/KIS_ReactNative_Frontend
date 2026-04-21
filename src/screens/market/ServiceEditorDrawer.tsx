import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Asset, launchImageLibrary } from 'react-native-image-picker';

import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import { KISIcon } from '@/constants/kisIcons';
import { marketLayout, marketStyles } from './market.styles';
import { KIS_COIN_CODE, KIS_TO_USD_RATE } from '@/screens/market/market.constants';
import { resolveBackendAssetUrl } from '@/network';
import AvailabilityScheduler from './AvailabilityScheduler';
import { createDefaultAvailability, normalizeAvailabilityPayload, ServiceAvailability } from './availabilityUtils';
import CategoryPickerModal from './CategoryPickerModal';
import { useCatalogCategories } from './useCatalogCategories';
import { CATEGORY_SELECTION_LIMIT } from '@/screens/market/market.constants';

type PickedImage = {
  uri: string;
  name: string;
  type: string;
};

type PersistedMedia = PickedImage & {
  id?: string;
};

type ServiceDeliveryMode = 'onsite' | 'remote' | 'instore' | 'pickup_dropoff';
type ServicePricingModel = 'fixed' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'project' | 'quote_only' | 'subscription';
type ServiceFulfillmentType = 'appointment' | 'instant' | 'scheduled' | 'recurring' | 'emergency';
type ServiceVisibility = 'public' | 'unlisted' | 'private';
type ServiceStatus = 'draft' | 'published' | 'paused';

type ServicePackage = {
  id: string;
  name: string;
  description: string;
  price: string;
  durationMinutes: string;
  revisions: string;
};

type ServiceAddon = {
  id: string;
  name: string;
  price: string;
  description: string;
};

type CustomerRequirement = {
  id: string;
  label: string;
  type: 'text' | 'long_text' | 'phone' | 'email' | 'file' | 'location' | 'date';
  required: boolean;
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const createPackage = (): ServicePackage => ({
  id: createId(),
  name: '',
  description: '',
  price: '',
  durationMinutes: '',
  revisions: '',
});

const createAddon = (): ServiceAddon => ({
  id: createId(),
  name: '',
  price: '',
  description: '',
});

const createRequirement = (): CustomerRequirement => ({
  id: createId(),
  label: '',
  type: 'text',
  required: false,
});

const SERVICE_CATEGORY_TYPES = new Set(['service', 'both']);

const collectEditorCategoryIds = (categories: any[], allowedTypes: Set<string>) =>
  (Array.isArray(categories) ? categories : [])
    .map((category) => ({
      id: category?.id,
      type: String(category?.category_type ?? 'product').toLowerCase(),
    }))
    .filter((entry) => entry.id && allowedTypes.has(entry.type))
    .map((entry) => String(entry.id))
    .slice(0, CATEGORY_SELECTION_LIMIT);

const buildPickedImage = (asset: Asset | undefined, prefix: string): PickedImage | null => {
  if (!asset?.uri) return null;
  const extension = (asset.type || 'image/jpeg').split('/')[1] || 'jpg';
  const name = asset.fileName || `${prefix}_${Date.now()}.${extension}`;
  return { uri: asset.uri, name, type: asset.type || 'image/jpeg' };
};

const sanitizeDecimalInput = (value: string) => value.replace(/[^0-9.]/g, '');
const sanitizeIntegerInput = (value: string) => value.replace(/[^0-9]/g, '');

const normalizeCommaList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeEditorPackage = (pkg: any): ServicePackage => ({
  id: String(pkg?.id ?? createId()),
  name: String(pkg?.name ?? ''),
  description: String(pkg?.description ?? ''),
  price: String(pkg?.price ?? ''),
  durationMinutes: String(pkg?.duration_minutes ?? pkg?.durationMinutes ?? ''),
  revisions: String(pkg?.revisions ?? pkg?.sessions ?? ''),
});

const normalizeEditorAddon = (addon: any): ServiceAddon => ({
  id: String(addon?.id ?? createId()),
  name: String(addon?.name ?? ''),
  price: String(addon?.price ?? ''),
  description: String(addon?.description ?? ''),
});

const normalizeEditorRequirement = (req: any): CustomerRequirement => ({
  id: String(req?.id ?? createId()),
  label: String(req?.label ?? req?.name ?? ''),
  type: (['text', 'long_text', 'phone', 'email', 'file', 'location', 'date'].includes(String(req?.type))
    ? req?.type
    : 'text') as CustomerRequirement['type'],
  required: Boolean(req?.required),
});


const DEFAULT_SERVICE_FORM = {
  name: '',
  shortSummary: '',
  description: '',
  tagsText: '',
  categoryIds: [] as string[],

  serviceType: 'appointment' as ServiceFulfillmentType,
  deliveryModes: ['onsite'] as ServiceDeliveryMode[],

  pricingModel: 'fixed' as ServicePricingModel,
  price: '',
  compareAtPrice: '',
  currencyCode: KIS_COIN_CODE,
  depositAmount: '',
  depositPercent: '',
  minimumCharge: '',
  otherShopsDiscount: '',
  negotiable: false,
  taxInclusive: false,
  quoteRequired: false,

  durationMinutes: '',
  prepBufferMinutes: '',
  cleanupBufferMinutes: '',
  turnaroundHours: '',

  maxBookingsPerSlot: '1',
  groupBookingAllowed: false,
  allowMultipleAttendeesPerSlot: false,
  maxParticipants: '',
  staffRequired: '',

  minNoticeHours: '',
  maxAdvanceBookingDays: '',
  cancellationWindowHours: '',
  rescheduleWindowHours: '',
  autoConfirmBooking: true,
  approvalRequired: false,

  coverage: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  travelRadiusKm: '',
  remoteRegionsText: '',
  timezone: 'Africa/Lagos',
  remoteMeetingLink: '',

  featuredImage: '',
  galleryImages: [] as PickedImage[],

  availability: createDefaultAvailability({ timezone: 'Africa/Lagos' }),
  availabilityRules: [] as any[],
  blackoutDatesText: '',

  packages: [] as ServicePackage[],
  addons: [] as ServiceAddon[],
  requirements: [] as CustomerRequirement[],

  refundPolicy: '',
  warrantyPolicy: '',
  serviceTerms: '',

  seoTitle: '',
  seoDescription: '',

  visibility: 'public' as ServiceVisibility,
  status: 'draft' as ServiceStatus,
  featured: false,
};

type ServiceEditorDrawerProps = {
  visible: boolean;
  mode: 'create' | 'edit';
  shop?: any;
  service?: any | null;
  loading?: boolean;
  onClose: () => void;
  onSave: (payload: any) => void;
};

const DELIVERY_MODE_OPTIONS: { key: ServiceDeliveryMode; label: string; icon: string }[] = [
  { key: 'onsite', label: 'On-site', icon: 'map-pin' },
  { key: 'remote', label: 'Remote', icon: 'video' },
  { key: 'instore', label: 'In-store', icon: 'shop' },
  { key: 'pickup_dropoff', label: 'Pickup/Drop-off', icon: 'truck' },
];

const PRICING_MODEL_OPTIONS: { key: ServicePricingModel; label: string }[] = [
  { key: 'fixed', label: 'Fixed' },
  { key: 'hourly', label: 'Hourly' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'project', label: 'Per project' },
  { key: 'quote_only', label: 'Quote only' },
  { key: 'subscription', label: 'Subscription' },
];

const FULFILLMENT_OPTIONS: { key: ServiceFulfillmentType; label: string }[] = [
  { key: 'appointment', label: 'Appointment' },
  { key: 'instant', label: 'Instant' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'emergency', label: 'Emergency' },
];

const VISIBILITY_OPTIONS: ServiceVisibility[] = ['public', 'unlisted', 'private'];
const STATUS_OPTIONS: ServiceStatus[] = ['draft', 'published', 'paused'];

export default function ServiceEditorDrawer({
  visible,
  mode,
  shop,
  service,
  loading,
  onClose,
  onSave,
}: ServiceEditorDrawerProps) {
  const { palette } = useKISTheme();
  const slide = useRef(new Animated.Value(marketLayout.drawerWidth)).current;

  const helperTextStyle = {
    color: palette.subtext,
    fontSize: 11,
    marginTop: 4,
    marginBottom: 8,
  } as const;

  const [form, setForm] = useState(() => ({ ...DEFAULT_SERVICE_FORM }));
  const [featuredImageAsset, setFeaturedImageAsset] = useState<PersistedMedia | null>(null);
  const [galleryImages, setGalleryImages] = useState<PersistedMedia[]>([]);
  const [removedGalleryImageIds, setRemovedGalleryImageIds] = useState<string[]>([]);
  const [removeFeaturedImage, setRemoveFeaturedImage] = useState(false);

  const [serviceCategoryModalVisible, setServiceCategoryModalVisible] = useState(false);
  const { categories: catalogCategories, loading: catalogLoading } = useCatalogCategories('service');
  const serviceCatalogCategories = useMemo(
    () => catalogCategories.filter((category) => category.category_type === 'service'),
    [catalogCategories],
  );
  const selectedServiceCategories = useMemo(
    () => serviceCatalogCategories.filter((category) => form.categoryIds.includes(category.id)),
    [serviceCatalogCategories, form.categoryIds],
  );

  const priceInUsd = useMemo(() => {
    const numeric = Number(form.price);
    return Number.isFinite(numeric) ? (numeric * KIS_TO_USD_RATE).toFixed(2) : '0.00';
  }, [form.price]);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : marketLayout.drawerWidth,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  useEffect(() => {
    if (!visible) return;

    if (mode === 'edit' && service) {
      const existingMedia = Array.isArray(service.images) ? service.images : [];
      const normalizedMedia = existingMedia
        .map((asset: any, index: number) => {
          const uri = asset?.image_url || asset?.image_file || asset?.url || asset?.uri || '';
          if (!uri) return null;
          return {
            id: asset?.id ? String(asset.id) : undefined,
            uri,
            name: asset?.name || `service-${index}.jpg`,
            type: 'image/jpeg',
          };
        })
        .filter(Boolean) as PersistedMedia[];

      const fallbackImageUri = resolveBackendAssetUrl(service.image_url || service.image_file || '') ?? '';
      setFeaturedImageAsset(
        fallbackImageUri
          ? { uri: fallbackImageUri, name: 'service-featured.jpg', type: 'image/jpeg' }
          : null,
      );
      setGalleryImages(normalizedMedia);
      setRemovedGalleryImageIds([]);
      setRemoveFeaturedImage(false);

      setForm({
        ...DEFAULT_SERVICE_FORM,
        ...service,
        name: service.name ?? '',
        shortSummary: service.short_summary ?? '',
        description: service.description ?? '',
        categoryIds: collectEditorCategoryIds(service.catalog_categories, SERVICE_CATEGORY_TYPES),
        price: String(service.price ?? ''),
        compareAtPrice: String(service.compare_at_price ?? ''),
        otherShopsDiscount: String(service.other_shops_discount ?? ''),
        depositAmount: String(service.deposit_amount ?? ''),
        depositPercent: String(service.deposit_percent ?? ''),
        minimumCharge: String(service.minimum_charge ?? ''),
        durationMinutes: String(service.duration_minutes ?? ''),
        prepBufferMinutes: String(service.prep_buffer_minutes ?? ''),
        cleanupBufferMinutes: String(service.cleanup_buffer_minutes ?? ''),
        turnaroundHours: String(service.turnaround_hours ?? ''),
        maxBookingsPerSlot: String(service.max_bookings_per_slot ?? '1'),
        maxParticipants: String(service.max_participants ?? ''),
        staffRequired: String(service.staff_required ?? ''),
        minNoticeHours: String(service.min_notice_hours ?? ''),
        maxAdvanceBookingDays: String(service.max_advance_booking_days ?? ''),
        cancellationWindowHours: String(service.cancellation_window_hours ?? ''),
        rescheduleWindowHours: String(service.reschedule_window_hours ?? ''),
        coverage: Array.isArray(service.coverage) ? service.coverage.join(', ') : service.coverage ?? '',
        remoteRegionsText: Array.isArray(service.remote_regions) ? service.remote_regions.join(', ') : '',
        blackoutDatesText: Array.isArray(service.blackout_dates) ? service.blackout_dates.join(', ') : '',
        tagsText: Array.isArray(service.tags) ? service.tags.join(', ') : '',
        deliveryModes: Array.isArray(service.delivery_modes) && service.delivery_modes.length ? service.delivery_modes : ['onsite'],
        serviceType: service.service_type ?? 'appointment',
        pricingModel: service.pricing_model ?? 'fixed',
        negotiable: Boolean(service.negotiable),
        taxInclusive: Boolean(service.tax_inclusive),
        quoteRequired: Boolean(service.quote_required),
        groupBookingAllowed: Boolean(service.group_booking_allowed),
        autoConfirmBooking: Boolean(service.auto_confirm_booking),
        approvalRequired: Boolean(service.approval_required),
        visibility: service.visibility ?? 'public',
        status: service.status ?? 'draft',
        addressLine1: service.address_line1 ?? '',
        addressLine2: service.address_line2 ?? '',
        city: service.city ?? '',
        state: service.state ?? '',
        country: service.country ?? '',
        postalCode: service.postal_code ?? '',
        travelRadiusKm: String(service.travel_radius_km ?? ''),
        timezone: service.timezone ?? 'Africa/Lagos',
        featuredImage: fallbackImageUri,
        packages: Array.isArray(service.packages) ? service.packages.map(normalizeEditorPackage) : [],
        addons: Array.isArray(service.addons) ? service.addons.map(normalizeEditorAddon) : [],
        requirements: Array.isArray(service.requirements) ? service.requirements.map(normalizeEditorRequirement) : [],
        availability: normalizeAvailabilityPayload(service.availability),
        availabilityRules: Array.isArray(service.availability_rules) ? service.availability_rules : [],
        allowMultipleAttendeesPerSlot: Boolean(service.allow_multiple_attendees_per_slot),
        remoteMeetingLink: service.remote_meeting_link ?? '',
        refundPolicy: service.refund_policy ?? '',
        warrantyPolicy: service.warranty_policy ?? '',
        serviceTerms: service.service_terms ?? '',
        seoTitle: service.seo_title ?? '',
        seoDescription: service.seo_description ?? '',
        featured: Boolean(service.featured ?? service.is_featured),
      });
    } else {
      setForm({ ...DEFAULT_SERVICE_FORM });
      setFeaturedImageAsset(null);
      setGalleryImages([]);
      setRemovedGalleryImageIds([]);
      setRemoveFeaturedImage(false);
    }
  }, [visible, mode, service]);

  const updateField = (changes: Partial<typeof DEFAULT_SERVICE_FORM>) => {
    setForm((prev) => ({ ...prev, ...changes }));
  };

  const handleServiceCategorySelect = (categoryId: string) => {
    setForm((prev) => {
      const exists = prev.categoryIds.includes(categoryId);
      if (exists) {
        return { ...prev, categoryIds: prev.categoryIds.filter((id) => id !== categoryId) };
      }
      if (prev.categoryIds.length >= CATEGORY_SELECTION_LIMIT) {
        return prev;
      }
      return { ...prev, categoryIds: [...prev.categoryIds, categoryId] };
    });
  };

  const toggleDeliveryMode = (modeKey: ServiceDeliveryMode) => {
    setForm((prev) => {
      const exists = prev.deliveryModes.includes(modeKey);
      const next = exists
        ? prev.deliveryModes.filter((item) => item !== modeKey)
        : [...prev.deliveryModes, modeKey];

      return {
        ...prev,
        deliveryModes: next.length ? next : ['onsite'],
      };
    });
  };

  const updateTimezoneField = (value: string) => {
    setForm((prev) => {
      const currentAvailability =
        prev.availability ?? createDefaultAvailability({ timezone: prev.timezone || 'UTC' });
      return {
        ...prev,
        timezone: value,
        availability: { ...currentAvailability, timezone: value || currentAvailability.timezone },
      };
    });
  };

  const addPackage = () => {
    setForm((prev) => ({ ...prev, packages: [...prev.packages, createPackage()] }));
  };

  const updatePackage = (id: string, changes: Partial<ServicePackage>) => {
    setForm((prev) => ({
      ...prev,
      packages: prev.packages.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    }));
  };

  const removePackage = (id: string) => {
    setForm((prev) => ({
      ...prev,
      packages: prev.packages.filter((item) => item.id !== id),
    }));
  };

  const addAddon = () => {
    setForm((prev) => ({ ...prev, addons: [...prev.addons, createAddon()] }));
  };

  const updateAddon = (id: string, changes: Partial<ServiceAddon>) => {
    setForm((prev) => ({
      ...prev,
      addons: prev.addons.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    }));
  };

  const removeAddon = (id: string) => {
    setForm((prev) => ({
      ...prev,
      addons: prev.addons.filter((item) => item.id !== id),
    }));
  };

  const addRequirement = () => {
    setForm((prev) => ({ ...prev, requirements: [...prev.requirements, createRequirement()] }));
  };

  const updateRequirement = (id: string, changes: Partial<CustomerRequirement>) => {
    setForm((prev) => ({
      ...prev,
      requirements: prev.requirements.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    }));
  };

  const removeRequirement = (id: string) => {
    setForm((prev) => ({
      ...prev,
      requirements: prev.requirements.filter((item) => item.id !== id),
    }));
  };

  const handlePickServiceImage = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
      const asset = result.assets?.[0];
      const image = buildPickedImage(asset, 'service_featured');
      if (!image) return;

      setFeaturedImageAsset(image);
      setRemoveFeaturedImage(false);
      updateField({ featuredImage: image.uri });
    } catch (error) {
      console.error('Service image pick failed', error);
    }
  };

  const handleAddServiceImages = useCallback(async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 20 });
      const assets = result.assets ?? [];
      const picked = assets
        .map((asset, index) => buildPickedImage(asset, `service_gallery_${index}`))
        .filter(Boolean) as PickedImage[];

      if (!picked.length) return;

      setGalleryImages((prev) => {
        const seen = new Set(prev.map((img) => img.uri));
        const additions = picked.filter((img) => !seen.has(img.uri));
        return [...prev, ...additions];
      });
    } catch (error) {
      console.error('Service gallery pick failed', error);
    }
  }, []);

  const handleClearFeaturedImage = useCallback(() => {
    setRemoveFeaturedImage(Boolean(service?.image_url || service?.image_file));
    setFeaturedImageAsset(null);
    updateField({ featuredImage: '' });
  }, [service]);

  const handleRemoveServiceImage = useCallback(
    (uri: string) => {
      setGalleryImages((prev) => {
        const removed = prev.find((img) => img.uri === uri);
        if (removed?.id) {
          setRemovedGalleryImageIds((existing) =>
            existing.includes(removed.id as string) ? existing : [...existing, removed.id as string],
          );
        }
        const remaining = prev.filter((img) => img.uri !== uri);
        return remaining;
      });
    },
    [],
  );

  const renderSectionHeader = (icon: string, title: string) => (
    <View style={marketStyles.drawerSectionHeader}>
      <KISIcon name={icon} size={18} color={palette.primaryStrong} />
      <Text style={[marketStyles.drawerSectionTitle, { color: palette.text }]}>{title}</Text>
    </View>
  );

  const chipStyle = (active: boolean) => ({
    borderWidth: 1,
    borderColor: active ? palette.primary : palette.divider,
    backgroundColor: active ? `${palette.primary}22` : palette.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  });

  const chipTextStyle = (active: boolean) => ({
    color: active ? palette.primaryStrong : palette.text,
    fontSize: 12,
    fontWeight: '600' as const,
  });

  const effectiveAvailability: ServiceAvailability = useMemo(
    () => form.availability ?? createDefaultAvailability({ timezone: form.timezone || 'UTC' }),
    [form.availability, form.timezone],
  );

  const buildPayload = (draft: boolean) => ({
    ...form,
    availability: effectiveAvailability,
    id: service?.id,
    shopId: shop?.id,
    draft,
    featuredImageAsset,
    gallery_images: galleryImages,
    remove_featured_image: removeFeaturedImage,
    remove_image_ids: removedGalleryImageIds,
    tags: normalizeCommaList(form.tagsText),
    coverage: normalizeCommaList(form.coverage),
    remoteRegions: normalizeCommaList(form.remoteRegionsText),
    blackoutDates: normalizeCommaList(form.blackoutDatesText),
    publishedAt: !draft && form.status !== 'published' ? new Date().toISOString() : service?.published_at ?? null,
  });

  return (
    <>
      {visible && <Pressable style={marketStyles.drawerOverlay} onPress={onClose} />}

      <Animated.View
        style={[
          marketStyles.drawerContainer,
          marketStyles.drawerContent,
          {
            transform: [{ translateX: slide }],
            backgroundColor: palette.card,
          },
        ]}
      >
          <View style={[marketStyles.drawerHeader, { borderBottomColor: palette.divider }]}>
            <View>
              <Text style={[marketStyles.drawerTitle, { color: palette.text }]}>
                {mode === 'edit' ? 'Edit service' : 'Add service'}
              </Text>
              <Text style={[marketStyles.drawerSubtitle, { color: palette.subtext }]}>
                Build a premium, bookable, scalable service listing.
              </Text>
            </View>
            <Pressable onPress={onClose} style={{ padding: 6 }}>
              <KISIcon name="close" size={22} color={palette.subtext} />
            </Pressable>
          </View>

          <ScrollView
            style={marketStyles.drawerScroll}
            contentContainerStyle={marketStyles.drawerBody}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ gap: 16 }}>
            <View style={marketStyles.drawerSection}>
              {renderSectionHeader('briefcase', 'Service identity')}
              <KISTextInput label="Service name" value={form.name} onChangeText={(value) => updateField({ name: value })} />
              <KISTextInput
                label="Short summary"
                value={form.shortSummary}
                onChangeText={(value) => updateField({ shortSummary: value })}
              />
              <KISTextInput
                label="Description"
                value={form.description}
                onChangeText={(value) => updateField({ description: value })}
                multiline
              />
              <KISTextInput
                label="Tags (comma separated)"
                value={form.tagsText}
                onChangeText={(value) => updateField({ tagsText: value })}
              />

              <View style={{ marginTop: 12 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600' }}>Service categories</Text>
                {serviceCatalogCategories.length ? (
                  <>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      {selectedServiceCategories.map((category) => (
                        <View
                          key={category.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: palette.divider,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            backgroundColor: palette.surface,
                            gap: 6,
                          }}
                        >
                          <Text style={{ color: palette.text, fontSize: 12, fontWeight: '600' }}>
                            {category.name || 'Category'}
                          </Text>
                          <Pressable onPress={() => handleServiceCategorySelect(category.id)} style={{ padding: 4 }}>
                            <KISIcon name="close" size={12} color={palette.error ?? '#E53935'} />
                          </Pressable>
                        </View>
                      ))}
                      {!selectedServiceCategories.length && (
                        <Text style={{ color: palette.subtext, fontSize: 12 }}>No categories selected yet.</Text>
                      )}
                    </View>
                    <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 6 }}>
                      {form.categoryIds.length}/{CATEGORY_SELECTION_LIMIT} selected
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 8 }}>
                    {catalogLoading ? 'Loading service categories…' : 'No service categories available yet.'}
                  </Text>
                )}
                <KISButton
                  title="Add service categories"
                  size="sm"
                  variant="secondary"
                  onPress={() => setServiceCategoryModalVisible(true)}
                  disabled={catalogLoading || !serviceCatalogCategories.length}
                  style={{ marginTop: 8 }}
                />
              </View>
            </View>

            <View style={marketStyles.drawerSection}>
              {renderSectionHeader('layers', 'Delivery & fulfillment')}
              <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 8 }}>
                How and where this service is delivered.
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {DELIVERY_MODE_OPTIONS.map((item) => {
                  const active = form.deliveryModes.includes(item.key);
                  return (
                    <Pressable key={item.key} onPress={() => toggleDeliveryMode(item.key)} style={chipStyle(active)}>
                      <Text style={chipTextStyle(active)}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600' }}>Fulfillment type</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {FULFILLMENT_OPTIONS.map((option) => {
                    const active = form.serviceType === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => updateField({ serviceType: option.key })}
                        style={chipStyle(active)}
                      >
                        <Text style={chipTextStyle(active)}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={marketStyles.drawerSection}>
              {renderSectionHeader('wallet', 'Pricing')}
              <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 8 }}>
                Set how customers will be charged for this service.
              </Text>

              <KISTextInput
                label="Base price"
                value={form.price}
                onChangeText={(value) => updateField({ price: sanitizeDecimalInput(value) })}
                keyboardType="numeric"
              />

              <KISTextInput
                label="Compare-at price"
                value={form.compareAtPrice}
                onChangeText={(value) => updateField({ compareAtPrice: sanitizeDecimalInput(value) })}
                keyboardType="numeric"
              />
              <Text style={helperTextStyle}>
                Optional. Show the original price to highlight discounts or promotions.
              </Text>

              <KISTextInput
                label="Minimum charge"
                value={form.minimumCharge}
                onChangeText={(value) => updateField({ minimumCharge: sanitizeDecimalInput(value) })}
                keyboardType="numeric"
              />
              <Text style={helperTextStyle}>
                The lowest amount charged for this service, even for small jobs.
              </Text>

              <KISTextInput
                label="Deposit amount"
                value={form.depositAmount}
                onChangeText={(value) => updateField({ depositAmount: sanitizeDecimalInput(value) })}
                keyboardType="numeric"
              />
              <Text style={helperTextStyle}>
                Fixed upfront payment required to confirm a booking.
              </Text>

              <KISTextInput
                label="Deposit percent"
                value={form.depositPercent}
                onChangeText={(value) => updateField({ depositPercent: sanitizeDecimalInput(value) })}
                keyboardType="numeric"
              />
              <Text style={helperTextStyle}>
                Percentage of the service price paid upfront.
              </Text>

              <KISTextInput
                label="Partner / other shops discount (%)"
                value={form.otherShopsDiscount}
                onChangeText={(value) => updateField({ otherShopsDiscount: sanitizeDecimalInput(value) })}
                keyboardType="numeric"
              />
              <Text style={helperTextStyle}>
                Discount offered to partner shops or marketplace collaborators.
              </Text>

              <View style={{ marginTop: 12 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600' }}>Pricing model</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {PRICING_MODEL_OPTIONS.map((item) => {
                    const active = form.pricingModel === item.key;
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => updateField({ pricingModel: item.key })}
                        style={chipStyle(active)}
                      >
                        <Text style={chipTextStyle(active)}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ marginTop: 10 }}>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  Approximate USD value: ${priceInUsd}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  1 {KIS_COIN_CODE} = ${KIS_TO_USD_RATE} USD
                </Text>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {[
                  { key: 'negotiable', label: 'Negotiable' },
                  { key: 'taxInclusive', label: 'Tax inclusive' },
                  { key: 'quoteRequired', label: 'Quote required' },
                ].map((flag) => {
                  const active = (form as any)[flag.key];
                  return (
                    <Pressable
                      key={flag.key}
                      onPress={() => updateField({ [flag.key]: !active } as any)}
                      style={chipStyle(active)}
                    >
                      <Text style={chipTextStyle(active)}>{flag.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={marketStyles.drawerSection}>
              {renderSectionHeader('clock', 'Duration, capacity & operations')}
              <KISTextInput
                label="Duration (minutes)"
                value={form.durationMinutes}
                onChangeText={(value) => updateField({ durationMinutes: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />
              <KISTextInput
                label="Prep buffer (minutes)"
                value={form.prepBufferMinutes}
                onChangeText={(value) => updateField({ prepBufferMinutes: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />
              <KISTextInput
                label="Cleanup buffer (minutes)"
                value={form.cleanupBufferMinutes}
                onChangeText={(value) => updateField({ cleanupBufferMinutes: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />
              <KISTextInput
                label="Turnaround / SLA (hours)"
                value={form.turnaroundHours}
                onChangeText={(value) => updateField({ turnaroundHours: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />
              <KISTextInput
                label="Max bookings per slot"
                value={form.maxBookingsPerSlot}
                onChangeText={(value) => updateField({ maxBookingsPerSlot: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />
              <KISTextInput
                label="Max participants"
                value={form.maxParticipants}
                onChangeText={(value) => updateField({ maxParticipants: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />
              <KISTextInput
                label="Staff required"
                value={form.staffRequired}
                onChangeText={(value) => updateField({ staffRequired: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {[
                  { key: 'groupBookingAllowed', label: 'Group booking allowed' },
                  { key: 'allowMultipleAttendeesPerSlot', label: 'Multi-attendee per slot' },
                ].map((flag) => {
                  const active = (form as any)[flag.key];
                  return (
                    <Pressable
                      key={flag.key}
                      onPress={() => updateField({ [flag.key]: !active } as any)}
                      style={chipStyle(active)}
                    >
                      <Text style={chipTextStyle(active)}>{flag.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={marketStyles.drawerSection}>
              {renderSectionHeader('calendar-clock', 'Booking rules')}
              <KISTextInput
                label="Minimum notice (hours)"
                value={form.minNoticeHours}
                onChangeText={(value) => updateField({ minNoticeHours: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />
              <KISTextInput
                label="Max advance booking (days)"
                value={form.maxAdvanceBookingDays}
                onChangeText={(value) => updateField({ maxAdvanceBookingDays: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />
              <KISTextInput
                label="Cancellation window (hours)"
                value={form.cancellationWindowHours}
                onChangeText={(value) => updateField({ cancellationWindowHours: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />
              <KISTextInput
                label="Reschedule window (hours)"
                value={form.rescheduleWindowHours}
                onChangeText={(value) => updateField({ rescheduleWindowHours: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {[
                  { key: 'autoConfirmBooking', label: 'Auto confirm bookings' },
                  { key: 'approvalRequired', label: 'Approval required' },
                ].map((flag) => {
                  const active = (form as any)[flag.key];
                  return (
                    <Pressable
                      key={flag.key}
                      onPress={() => updateField({ [flag.key]: !active } as any)}
                      style={chipStyle(active)}
                    >
                      <Text style={chipTextStyle(active)}>{flag.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[marketStyles.drawerSection, { marginTop: 12, padding: 12 }]}> 
              <Text style={{ color: palette.text, fontWeight: "700", marginBottom: 8 }}>Availability schedule</Text>
              <AvailabilityScheduler
                value={effectiveAvailability}
                onChange={(value) => updateField({ availability: value })}
              />

              <KISTextInput
                label="Blackout dates (comma separated YYYY-MM-DD)"
                value={form.blackoutDatesText}
                onChangeText={(value) => updateField({ blackoutDatesText: value })}
              />
            </View>

            <View style={marketStyles.drawerSection}>
              {renderSectionHeader('map-pin', 'Coverage & location')}
              <KISTextInput
                label="Coverage regions (comma separated)"
                value={form.coverage}
                onChangeText={(value) => updateField({ coverage: value })}
              />
              <KISTextInput
                label="Remote regions (comma separated)"
                value={form.remoteRegionsText}
                onChangeText={(value) => updateField({ remoteRegionsText: value })}
              />
              <KISTextInput
                label="Remote meeting link"
                value={form.remoteMeetingLink}
                onChangeText={(value) => updateField({ remoteMeetingLink: value })}
                placeholder="https://meet.platform.com/session"
              />
              <KISTextInput label="Address line 1" value={form.addressLine1} onChangeText={(value) => updateField({ addressLine1: value })} />
              <KISTextInput label="Address line 2" value={form.addressLine2} onChangeText={(value) => updateField({ addressLine2: value })} />
              <KISTextInput label="City" value={form.city} onChangeText={(value) => updateField({ city: value })} />
              <KISTextInput label="State / Region" value={form.state} onChangeText={(value) => updateField({ state: value })} />
              <KISTextInput label="Country" value={form.country} onChangeText={(value) => updateField({ country: value })} />
              <KISTextInput label="Postal code" value={form.postalCode} onChangeText={(value) => updateField({ postalCode: value })} />
              <KISTextInput
                label="Travel radius (km)"
                value={form.travelRadiusKm}
                onChangeText={(value) => updateField({ travelRadiusKm: sanitizeIntegerInput(value) })}
                keyboardType="numeric"
              />
              <KISTextInput label="Timezone" value={form.timezone} onChangeText={updateTimezoneField} />
            </View>

            <View style={marketStyles.drawerSection}>
              {renderSectionHeader('sparkles', 'Packages')}
              <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 8 }}>
                Offer Basic / Standard / Premium or custom tiers.
              </Text>

              {form.packages.map((pkg, index) => (
                <View
                  key={pkg.id ?? `package-${index}`}
                  style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 14, padding: 12, marginBottom: 10 }}
                >
                  <KISTextInput label="Package name" value={pkg.name} onChangeText={(value) => updatePackage(pkg.id, { name: value })} />
                  <KISTextInput label="Description" value={pkg.description} onChangeText={(value) => updatePackage(pkg.id, { description: value })} multiline />
                  <KISTextInput label="Price" value={pkg.price} onChangeText={(value) => updatePackage(pkg.id, { price: sanitizeDecimalInput(value) })} keyboardType="numeric" />
                  <KISTextInput label="Duration (minutes)" value={pkg.durationMinutes} onChangeText={(value) => updatePackage(pkg.id, { durationMinutes: sanitizeIntegerInput(value) })} keyboardType="numeric" />
                  <KISTextInput label="Revisions / sessions" value={pkg.revisions} onChangeText={(value) => updatePackage(pkg.id, { revisions: sanitizeIntegerInput(value) })} keyboardType="numeric" />
                  <Pressable onPress={() => removePackage(pkg.id)} style={{ marginTop: 8 }}>
                    <Text style={{ color: palette.primary, fontWeight: '700' }}>Remove package</Text>
                  </Pressable>
                </View>
              ))}

              <Pressable onPress={addPackage}>
                <Text style={{ color: palette.primary, fontWeight: '700' }}>+ Add package</Text>
              </Pressable>
            </View>

            <View style={marketStyles.drawerSection}>
              {renderSectionHeader('plus-circle', 'Add-ons')}
              {form.addons.map((addon, index) => (
                <View
                  key={addon.id ?? `addon-${index}`}
                  style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 14, padding: 12, marginBottom: 10 }}
                >
                  <KISTextInput label="Add-on name" value={addon.name} onChangeText={(value) => updateAddon(addon.id, { name: value })} />
                  <KISTextInput label="Price" value={addon.price} onChangeText={(value) => updateAddon(addon.id, { price: sanitizeDecimalInput(value) })} keyboardType="numeric" />
                  <KISTextInput label="Description" value={addon.description} onChangeText={(value) => updateAddon(addon.id, { description: value })} multiline />
                  <Pressable onPress={() => removeAddon(addon.id)} style={{ marginTop: 8 }}>
                    <Text style={{ color: palette.primary, fontWeight: '700' }}>Remove add-on</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={addAddon}>
                <Text style={{ color: palette.primary, fontWeight: '700' }}>+ Add add-on</Text>
              </Pressable>
            </View>

            <View style={marketStyles.drawerSection}>
              {renderSectionHeader('clipboard-list', 'Customer requirements')}
              <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 8 }}>
                Define what customers must provide before booking or checkout.
              </Text>

              {form.requirements.map((req, index) => (
                <View
                  key={req.id ?? `requirement-${index}`}
                  style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 14, padding: 12, marginBottom: 10 }}
                >
                  <KISTextInput label="Field label" value={req.label} onChangeText={(value) => updateRequirement(req.id, { label: value })} />

                  <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
                    Field type
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {(['text', 'long_text', 'phone', 'email', 'file', 'location', 'date'] as CustomerRequirement['type'][]).map((type) => {
                      const active = req.type === type;
                      return (
                        <Pressable
                          key={type}
                          onPress={() => updateRequirement(req.id, { type })}
                          style={chipStyle(active)}
                        >
                          <Text style={chipTextStyle(active)}>{type}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={{ marginTop: 10 }}>
                    <Pressable
                      onPress={() => updateRequirement(req.id, { required: !req.required })}
                      style={chipStyle(req.required)}
                    >
                      <Text style={chipTextStyle(req.required)}>
                        {req.required ? 'Required' : 'Optional'}
                      </Text>
                    </Pressable>
                  </View>

                  <Pressable onPress={() => removeRequirement(req.id)} style={{ marginTop: 10 }}>
                    <Text style={{ color: palette.primary, fontWeight: '700' }}>Remove field</Text>
                  </Pressable>
                </View>
              ))}

              <Pressable onPress={addRequirement}>
                <Text style={{ color: palette.primary, fontWeight: '700' }}>+ Add requirement field</Text>
              </Pressable>
            </View>

            <View style={marketStyles.drawerSection}>
              {renderSectionHeader('image', 'Media')}
              <KISButton
                title={form.featuredImage ? 'Change featured image' : 'Upload featured image'}
                onPress={handlePickServiceImage}
              />

              {form.featuredImage ? (
                <View style={{ position: 'relative', marginTop: 10 }}>
                  <Image
                    source={{ uri: form.featuredImage }}
                    style={{ width: '100%', height: 140, borderRadius: 14 }}
                  />
                  <Pressable
                    onPress={handleClearFeaturedImage}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: palette.surfaceElevated,
                      borderRadius: 14,
                      padding: 4,
                    }}
                  >
                    <KISIcon name="close" size={14} color={palette.error ?? '#E53935'} />
                  </Pressable>
                </View>
              ) : null}

              <View style={{ marginTop: 12 }}>
                <KISButton title="Add gallery photos" size="sm" onPress={handleAddServiceImages} />
                {galleryImages.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {galleryImages.map((image) => (
                      <View key={image.uri} style={{ width: 58, height: 58, borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
                        <Image source={{ uri: image.uri }} style={{ width: '100%', height: '100%' }} />
                        <Pressable
                          onPress={() => handleRemoveServiceImage(image.uri)}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            backgroundColor: palette.surface,
                            borderRadius: 12,
                            padding: 2,
                          }}
                        >
                          <KISIcon name="close" size={12} color={palette.error ?? '#E53935'} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 8 }}>No gallery photos yet.</Text>
                )}
              </View>
            </View>

            <View style={marketStyles.drawerSection}>
              {renderSectionHeader('shield-check', 'Policies')}
              <KISTextInput label="Refund policy" value={form.refundPolicy} onChangeText={(value) => updateField({ refundPolicy: value })} multiline />
              <KISTextInput label="Warranty / guarantee" value={form.warrantyPolicy} onChangeText={(value) => updateField({ warrantyPolicy: value })} multiline />
              <KISTextInput label="Service terms" value={form.serviceTerms} onChangeText={(value) => updateField({ serviceTerms: value })} multiline />
            </View>

            <View style={marketStyles.drawerSection}>
              {renderSectionHeader('search', 'SEO & discovery')}
              <KISTextInput label="SEO title" value={form.seoTitle} onChangeText={(value) => updateField({ seoTitle: value })} />
              <KISTextInput label="SEO description" value={form.seoDescription} onChangeText={(value) => updateField({ seoDescription: value })} multiline />
            </View>

            <View style={marketStyles.drawerSection}>
              {renderSectionHeader('eye', 'Visibility & publishing')}
              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>Visibility</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {VISIBILITY_OPTIONS.map((value) => {
                  const active = form.visibility === value;
                  return (
                    <Pressable key={value} onPress={() => updateField({ visibility: value })} style={chipStyle(active)}>
                      <Text style={chipTextStyle(active)}>{value}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 8 }}>Status</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {STATUS_OPTIONS.map((value) => {
                  const active = form.status === value;
                  return (
                    <Pressable key={value} onPress={() => updateField({ status: value })} style={chipStyle(active)}>
                      <Text style={chipTextStyle(active)}>{value}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ marginTop: 12 }}>
                <Pressable
                  onPress={() => updateField({ featured: !form.featured })}
                  style={chipStyle(form.featured)}
                >
                  <Text style={chipTextStyle(form.featured)}>Featured listing</Text>
                </Pressable>
              </View>
            </View>

            </View>

          </ScrollView>

          <View style={[marketStyles.drawerFooter, { borderTopColor: palette.divider }]}>            
            <View style={marketStyles.drawerFooterActions}>
              <KISButton title="Cancel" variant="ghost" size="sm" onPress={onClose} />
              <KISButton
                title="Save draft"
                variant="secondary"
                size="sm"
                onPress={() => onSave(buildPayload(true))}
                disabled={loading}
              />
            </View>

            <View style={marketStyles.drawerFooterActions}>
              <KISButton
                title={mode === 'edit' ? 'Save changes' : 'Publish service'}
                onPress={() => onSave(buildPayload(false))}
                disabled={loading}
              />
            </View>
          </View>
      </Animated.View>
      <CategoryPickerModal
        visible={serviceCategoryModalVisible}
        title="Pick service categories"
        description="Select up to five service categories or subcategories for this listing."
        categories={serviceCatalogCategories}
        selectedIds={form.categoryIds}
        selectionLimit={CATEGORY_SELECTION_LIMIT}
        onSelect={(categoryId) => handleServiceCategorySelect(categoryId)}
        onClose={() => setServiceCategoryModalVisible(false)}
      />
    </>
  );
}
