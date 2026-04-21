import ROUTES from '@/network';
import { deleteRequest } from '@/network/delete';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';

const MICROS_PER_KISC = 1000;

export const normalizeEngineKey = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^\w-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const kiscToMicro = (kisc?: number | string | null) => {
  const parsed = Number(kisc ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * MICROS_PER_KISC);
};

export const microToKisc = (micro?: number | string | null) => {
  const parsed = Number(micro ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed / MICROS_PER_KISC;
};

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
  amount_kisc?: string;
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
