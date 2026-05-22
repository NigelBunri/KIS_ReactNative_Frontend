import ROUTES from '@/network';
import { deleteRequest } from '@/network/delete';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';

const MICRO_UNITS_PER_USD = 1000;

export const normalizeEngineKey = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^\w-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const usdToMicro = (usd?: number | string | null) => {
  const parsed = Number(usd ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * MICRO_UNITS_PER_USD);
};

export const microToUsd = (micro?: number | string | null) => {
  const parsed = Number(micro ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed / MICRO_UNITS_PER_USD;
};

// Backward-compatible aliases for older health engine screens. New code should use USD naming.
export const kiscToMicro = usdToMicro;
export const microToKisc = microToUsd;

export type EngineManagedItem = {
  id: string;
  institution?: string;
  engine_key: string;
  engine_name?: string;
  parent?: string | null;
  item_kind: string;
  name: string;
  description?: string;
  amount_micro?: number;
  amount_usd?: string;
  amount_kisc?: string; // legacy compatibility only
  quantity?: number | null;
  value_int?: number | null;
  value_date?: string | null;
  status?: string;
  image_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
  created_by?: string;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

type ListOptions = {
  itemKind?: string;
  parentId?: string;
  rootOnly?: boolean;
  includeInactive?: boolean;
};

export const fetchInstitutionEngineManagedItems = (
  institutionId: string,
  engineKey: string,
  options?: ListOptions,
) =>
  getRequest(ROUTES.healthOps.managedItems(institutionId, normalizeEngineKey(engineKey)), {
    params: {
      ...(options?.itemKind ? { item_kind: String(options.itemKind).trim().toLowerCase() } : {}),
      ...(options?.parentId ? { parent_id: String(options.parentId).trim() } : {}),
      ...(options?.rootOnly ? { root_only: true } : {}),
      ...(options?.includeInactive ? { include_inactive: true } : {}),
    },
    errorMessage: 'Unable to load engine managed items.',
  });

export const createInstitutionEngineManagedItem = (
  institutionId: string,
  engineKey: string,
  payload: Record<string, any>,
) =>
  postRequest(
    ROUTES.healthOps.managedItems(institutionId, normalizeEngineKey(engineKey)),
    payload,
    { errorMessage: 'Unable to create managed item.' },
  );

export const updateInstitutionEngineManagedItem = (
  institutionId: string,
  engineKey: string,
  itemId: string,
  payload: Record<string, any>,
) =>
  patchRequest(
    ROUTES.healthOps.managedItem(institutionId, normalizeEngineKey(engineKey), itemId),
    payload,
    { errorMessage: 'Unable to update managed item.' },
  );

export const deleteInstitutionEngineManagedItem = (
  institutionId: string,
  engineKey: string,
  itemId: string,
) =>
  deleteRequest(
    ROUTES.healthOps.managedItem(institutionId, normalizeEngineKey(engineKey), itemId),
    { errorMessage: 'Unable to delete managed item.' },
  );
