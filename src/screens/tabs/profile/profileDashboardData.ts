import type { KISIconName } from '@/constants/kisIcons';

export type DashboardActivityItem = {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  icon: KISIconName;
  tone: 'primary' | 'success' | 'warning' | 'info';
  onPress?: () => void;
  raw?: any;
};

export type ImpactSnapshotStat = {
  key: string;
  label: string;
  value: number;
  icon: KISIconName;
  tone: 'primary' | 'success' | 'warning' | 'info';
};

export type ImpactSnapshotSection = {
  key: string;
  label: string;
  count: number;
  items: any[];
};

export type ImpactSnapshotRange = 'all_time' | 'month' | 'year';

const resolveDate = (item: any): Date | null => {
  const raw =
    item?.created_at ??
    item?.createdAt ??
    item?.published_at ??
    item?.publishedAt ??
    item?.updated_at ??
    item?.updatedAt ??
    item?.date ??
    item?.timestamp ??
    null;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isInRange = (item: any, range: ImpactSnapshotRange) => {
  if (range === 'all_time') return true;
  const date = resolveDate(item);
  if (!date) return false;
  const now = new Date();
  if (range === 'month') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }
  if (range === 'year') {
    return date.getFullYear() === now.getFullYear();
  }
  return true;
};

export const buildRecentActivityItems = (
  profile: any,
  appointments: any[],
  openBookingDetails: (bookingId: string) => void,
  limit = 4,
): DashboardActivityItem[] => {
  const profileActivity = Array.isArray(profile?.sections?.activity)
    ? profile.sections.activity
    : [];
  if (profileActivity.length) {
    return profileActivity.slice(0, limit).map((item: any, index: number) => {
      const action = String(item?.action || 'Activity').replace(/\./g, ' ');
      const meta = item?.meta && typeof item.meta === 'object' ? item.meta : {};
      const title = String(meta?.title || meta?.label || action || 'Recent activity')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
      const description =
        String(meta?.summary || meta?.message || meta?.detail || '').trim() ||
        `Action: ${action}`;
      return {
        id: String(item?.id || `activity-${index}`),
        title,
        description,
        timestamp: item?.created_at ? new Date(item.created_at).toLocaleString() : undefined,
        icon: 'sparkles',
        tone: 'primary',
        raw: item,
      };
    });
  }
  return appointments.slice(0, limit).map((booking: any, index: number) => ({
    id: String(booking?.id || `booking-${index}`),
    title: booking?.service_name || 'Service booking',
    description:
      [booking?.shop_name || 'Provider', booking?.status || 'pending']
        .filter(Boolean)
        .join(' • ') || 'Recent booking',
    timestamp: booking?.scheduled_at
      ? new Date(booking.scheduled_at).toLocaleString()
      : undefined,
    icon: 'calendar',
    tone: 'info',
    onPress: booking?.id ? () => openBookingDetails(String(booking.id)) : undefined,
    raw: booking,
  }));
};

export const buildImpactSnapshotStats = (
  profile: any,
  range: ImpactSnapshotRange = 'all_time',
): ImpactSnapshotStat[] => {
  const articles = (Array.isArray(profile?.sections?.articles) ? profile.sections.articles : []).filter((item: any) =>
    isInRange(item, range),
  );
  const projects = (Array.isArray(profile?.sections?.projects) ? profile.sections.projects : []).filter((item: any) =>
    isInRange(item, range),
  );
  const testimonials = (
    Array.isArray(profile?.sections?.showcases?.testimonial)
      ? profile.sections.showcases.testimonial
      : []
  ).filter((item: any) => isInRange(item, range));
  const activity = (Array.isArray(profile?.sections?.activity) ? profile.sections.activity : []).filter((item: any) =>
    isInRange(item, range),
  );

  return [
    { key: 'articles', label: 'Articles', value: articles.length, icon: 'book', tone: 'primary' },
    { key: 'projects', label: 'Projects', value: projects.length, icon: 'sparkles', tone: 'warning' },
    { key: 'testimonials', label: 'Testimonials', value: testimonials.length, icon: 'comment', tone: 'success' },
    { key: 'activity', label: 'Activity', value: activity.length, icon: 'layers', tone: 'info' },
  ];
};

export const buildImpactSnapshotSections = (
  profile: any,
  range: ImpactSnapshotRange = 'all_time',
): ImpactSnapshotSection[] => {
  const sectionMap = [
    { key: 'articles', label: 'Articles', items: Array.isArray(profile?.sections?.articles) ? profile.sections.articles : [] },
    { key: 'projects', label: 'Projects', items: Array.isArray(profile?.sections?.projects) ? profile.sections.projects : [] },
    {
      key: 'testimonials',
      label: 'Testimonials',
      items: Array.isArray(profile?.sections?.showcases?.testimonial)
        ? profile.sections.showcases.testimonial
        : [],
    },
    { key: 'activity', label: 'Activity', items: Array.isArray(profile?.sections?.activity) ? profile.sections.activity : [] },
  ];

  return sectionMap.map((section) => {
    const items = section.items.filter((item: any) => isInRange(item, range));
    return {
      key: section.key,
      label: section.label,
      count: items.length,
      items,
    };
  });
};
