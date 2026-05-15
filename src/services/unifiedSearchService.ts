import ROUTES from '@/network';
import { getRequest } from '@/network/get';

export type UnifiedSearchKind =
  | 'contact'
  | 'conversation'
  | 'channel'
  | 'channel_content'
  | 'bible_verse'
  | 'health_institution'
  | 'notification'
  | 'verification';

export type UnifiedSearchResult = {
  kind: UnifiedSearchKind | string;
  title: string;
  subtitle?: string;
  target_type: string;
  target_id: string;
  route: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

export type UnifiedSearchResponse = {
  query: string;
  results: UnifiedSearchResult[];
  groups: Record<string, UnifiedSearchResult[]>;
  count: number;
};

export type UnifiedSearchParams = {
  q: string;
  groups?: string;
  limit?: number;
};

export const fetchUnifiedSearch = (params: UnifiedSearchParams) =>
  getRequest(ROUTES.search.unified, {
    params,
    errorMessage: 'Unable to search KIS right now.',
  });

export const groupUnifiedSearchResults = (payload?: Partial<UnifiedSearchResponse> | null) => {
  const groups = payload?.groups;
  if (groups && typeof groups === 'object') return groups;
  const rows = Array.isArray(payload?.results) ? payload.results : [];
  return rows.reduce<Record<string, UnifiedSearchResult[]>>((acc, row) => {
    const key = row.kind || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
};

