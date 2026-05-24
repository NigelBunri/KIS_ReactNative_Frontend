import { useCallback, useState } from 'react';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';

export type LocationEvent = {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'active' | 'closed' | 'cancelled';
  start_dt: string;
  end_dt: string;
  checkin_opens_before_minutes: number;
  late_after_minutes: number;
  recurrence: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
  recurrence_days: number[];
  recurrence_until: string | null;
  target_type: 'all' | 'roles' | 'users' | 'group' | 'community' | 'channel';
  center_lat: string;
  center_lng: string;
  radius_meters: number;
  show_arrival_order_to_members: boolean;
  show_checkin_count_to_members: boolean;
  attendance_count: number;
  is_checkin_open: boolean;
  created_at: string;
};

export type LocationAttendance = {
  id: string;
  user_id: string;
  user_display: { id: string; display_name: string; avatar_url: string | null };
  checked_in_at: string;
  is_late: boolean;
  arrival_number: number;
  distance_from_center_m: number;
  location_verified: boolean;
  source: string;
  is_manual: boolean;
};

export type LocationConsent = {
  id: string;
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  is_minor: boolean;
};

export type MyAttendanceStatus = {
  event: { id: string; title: string; status: string; is_checkin_open: boolean; radius_meters: number };
  checked_in: boolean;
  attendance: { id: string; checked_in_at: string; is_late: boolean; arrival_number: number; distance_from_center_m: number } | null;
  checkin_count: number | null;
  arrival_list: number[] | null;
};

export type CreateEventPayload = {
  title: string;
  description?: string;
  status?: string;
  start_dt: string;
  end_dt: string;
  checkin_opens_before_minutes?: number;
  late_after_minutes?: number;
  recurrence?: string;
  recurrence_days?: number[];
  recurrence_until?: string | null;
  target_type?: string;
  center_lat: string;
  center_lng: string;
  radius_meters: number;
  show_arrival_order_to_members?: boolean;
  show_checkin_count_to_members?: boolean;
};

export default function useGeolocationData(partnerId: string) {
  const [events, setEvents] = useState<LocationEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<LocationEvent | null>(null);
  const [attendance, setAttendance] = useState<LocationAttendance[]>([]);
  const [myStatus, setMyStatus] = useState<MyAttendanceStatus | null>(null);
  const [consent, setConsent] = useState<LocationConsent | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getRequest(ROUTES.partners.locationEvents(partnerId), {
      errorMessage: 'Unable to load location events.',
    });
    if (res?.success) {
      setEvents(Array.isArray(res.data?.events) ? res.data.events : []);
    } else {
      setError(res?.message || 'Failed to load events.');
    }
    setLoading(false);
  }, [partnerId]);

  const createEvent = useCallback(async (payload: CreateEventPayload) => {
    setSaving(true);
    setError(null);
    const res = await postRequest(ROUTES.partners.locationEvents(partnerId), payload, {
      errorMessage: 'Unable to create event.',
    });
    setSaving(false);
    if (res?.success) {
      const newEvent = res.data?.event as LocationEvent;
      setEvents(prev => [newEvent, ...prev]);
      return newEvent;
    }
    setError(res?.message || 'Failed to create event.');
    return null;
  }, [partnerId]);

  const updateEvent = useCallback(async (eventId: string, payload: Partial<CreateEventPayload>) => {
    setSaving(true);
    const res = await patchRequest(ROUTES.partners.locationEvent(partnerId, eventId), payload, {
      errorMessage: 'Unable to update event.',
    });
    setSaving(false);
    if (res?.success) {
      const updated = res.data?.event as LocationEvent;
      setEvents(prev => prev.map(e => e.id === eventId ? updated : e));
      if (selectedEvent?.id === eventId) setSelectedEvent(updated);
      return updated;
    }
    return null;
  }, [partnerId, selectedEvent]);

  const deleteEvent = useCallback(async (eventId: string) => {
    const res = await deleteRequest(ROUTES.partners.locationEvent(partnerId, eventId), {
      errorMessage: 'Unable to delete event.',
    });
    if (res?.success || res?.status === 204) {
      setEvents(prev => prev.filter(e => e.id !== eventId));
      if (selectedEvent?.id === eventId) setSelectedEvent(null);
      return true;
    }
    return false;
  }, [partnerId, selectedEvent]);

  const loadAttendance = useCallback(async (eventId: string) => {
    setLoading(true);
    const res = await getRequest(ROUTES.partners.locationAttendance(partnerId, eventId), {
      errorMessage: 'Unable to load attendance.',
    });
    setLoading(false);
    if (res?.success) {
      setAttendance(Array.isArray(res.data?.attendance) ? res.data.attendance : []);
      return res.data;
    }
    return null;
  }, [partnerId]);

  const loadMyStatus = useCallback(async (eventId: string) => {
    const res = await getRequest(ROUTES.partners.locationMyStatus(partnerId, eventId), {
      errorMessage: 'Unable to load your status.',
    });
    if (res?.success) {
      setMyStatus(res.data as MyAttendanceStatus);
      return res.data;
    }
    return null;
  }, [partnerId]);

  const checkin = useCallback(async (eventId: string, lat: number, lng: number, deviceOs?: string) => {
    setSaving(true);
    const res = await postRequest(
      ROUTES.partners.locationCheckin(partnerId, eventId),
      { lat, lng, device_os: deviceOs || '' },
      { errorMessage: 'Check-in failed.' },
    );
    setSaving(false);
    return res;
  }, [partnerId]);

  const loadConsent = useCallback(async () => {
    const res = await getRequest(ROUTES.partners.locationConsent(partnerId), {
      errorMessage: 'Unable to load consent record.',
    });
    if (res?.success) {
      setConsent(res.data?.consent as LocationConsent);
    }
  }, [partnerId]);

  const setConsented = useCallback(async (granted: boolean) => {
    const res = await postRequest(
      ROUTES.partners.locationConsent(partnerId),
      { granted },
      { errorMessage: 'Unable to update consent.' },
    );
    if (res?.success) {
      setConsent(res.data?.consent as LocationConsent);
      return true;
    }
    return false;
  }, [partnerId]);

  const manualCheckin = useCallback(async (eventId: string, userId: string) => {
    const res = await postRequest(
      ROUTES.partners.locationManualCheckin(partnerId, eventId),
      { user_id: userId },
      { errorMessage: 'Manual check-in failed.' },
    );
    return res;
  }, [partnerId]);

  return {
    events, selectedEvent, setSelectedEvent,
    attendance, myStatus, consent,
    loading, saving, error,
    loadEvents, createEvent, updateEvent, deleteEvent,
    loadAttendance, loadMyStatus, checkin,
    loadConsent, setConsented, manualCheckin,
  };
}
