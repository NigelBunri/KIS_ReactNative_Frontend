import type { CallType } from '@/services/calls/callTypes';

export const MIN_DURATION_MINUTES = 5;
export const MAX_DURATION_MINUTES = 1440; // 24h
export const DEFAULT_DURATION_MINUTES = 30;

export function clampDurationMinutes(mins: number): number {
  return Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, Math.round(mins)));
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) return '24h';
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function mergeDateAndTime(date: Date, time: Date): Date {
  const merged = new Date(date);
  merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return merged;
}

/**
 * Pulled out of ScheduleCallSheet so the "New call" submit-button gating —
 * a broadcast needs 1-30 panelists; a scheduled call must be set in the
 * future — can be unit-tested without mounting the sheet's own RN
 * component tree (no @testing-library/react-native in this project).
 */
export function evaluateNewCallSubmit(args: {
  callType: CallType;
  panelistCount: number;
  isScheduled: boolean;
  scheduledFor: Date;
  now?: Date;
}): { canSubmit: boolean; needsPanelists: boolean; scheduleInPast: boolean } {
  const now = args.now ?? new Date();
  const needsPanelists = args.callType === 'broadcast' && args.panelistCount < 1;
  const scheduleInPast = args.isScheduled && args.scheduledFor.getTime() <= now.getTime();
  return {
    needsPanelists,
    scheduleInPast,
    canSubmit: !needsPanelists && !scheduleInPast,
  };
}
