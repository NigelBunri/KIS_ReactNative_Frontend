import type { TimeRange } from '@/api/insights/types';

export type AnalyticsTimeRange = TimeRange;

export type BookingRecord = {
  id: string;
  created_at?: string;
  booked_at?: string;
  date?: string;
  status?: string;
  service_id?: string;
  service_name?: string;
  patient_id?: string;
  patient_name?: string;
  revenue_cents?: number;
};

export type ConsultationRecord = {
  id: string;
  started_at?: string;
  completed_at?: string;
  status?: string;
  patient_id?: string;
};

export type ScheduleRecord = {
  id: string;
  date?: string;
  starts_at?: string;
  status?: string;
};

export type PaymentRecord = {
  id: string;
  date?: string;
  paid_at?: string;
  created_at?: string;
  amount_cents?: number;
  amount?: number;
  method?: string;
  payment_method?: string;
  status?: string;
  service_id?: string;
  service_name?: string;
  patient_id?: string;
  patient_name?: string;
};

export type RatingRecord = {
  id: string;
  rating?: number;
  score?: number;
  created_at?: string;
};

export type TrafficSnapshot = {
  views?: number;
};

export type AnalyticsQueryPayload = {
  bookings: BookingRecord[];
  consultations: ConsultationRecord[];
  schedules: ScheduleRecord[];
  payments: PaymentRecord[];
  ratings: RatingRecord[];
  traffic: TrafficSnapshot;
};
