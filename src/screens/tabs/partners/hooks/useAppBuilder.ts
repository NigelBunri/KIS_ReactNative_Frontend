import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import type { PartnerOrganizationApp, PartnerOrganizationAppTab, PartnerOrganizationAppContentBlock } from './usePartnerOrganizationApps';

export type AppBuilderTab = PartnerOrganizationAppTab;
export type AppBuilderBlock = PartnerOrganizationAppContentBlock;

export type CreateAppPayload = {
  name: string;
  slug?: string;
  description?: string;
  type?: 'KIS' | 'BIBLE' | 'EXTERNAL';
  icon?: string;
  link?: string;
  status?: 'draft' | 'published' | 'archived';
  visible_to?: string[];
  config?: Record<string, any>;
};

export type CreateTabPayload = {
  title: string;
  slug?: string;
  description?: string;
  icon?: string;
  order?: number;
  visible_to?: string[];
  config?: Record<string, any>;
};

export type CreateBlockPayload = {
  block_type: string;
  title?: string;
  body?: string;
  media_url?: string;
  payload?: Record<string, any>;
  order?: number;
  status?: string;
};

export default function useAppBuilder(partnerId: string) {
  const [apps, setApps] = useState<PartnerOrganizationApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getRequest(ROUTES.partners.organizationApps(partnerId), {
      errorMessage: 'Unable to load apps.',
    });
    if (res?.success) {
      setApps(Array.isArray(res.data?.apps) ? res.data.apps : []);
    } else {
      setError(res?.message || 'Failed to load apps.');
    }
    setLoading(false);
  }, [partnerId]);

  const createApp = useCallback(async (payload: CreateAppPayload): Promise<PartnerOrganizationApp | null> => {
    setSaving(true);
    const res = await postRequest(ROUTES.partners.organizationApps(partnerId), payload, {
      errorMessage: 'Unable to create app.',
    });
    setSaving(false);
    if (res?.success) {
      const app = res.data?.app ?? res.data;
      setApps((prev) => [...prev, app]);
      return app;
    }
    Alert.alert('Error', res?.message || 'Failed to create app.');
    return null;
  }, [partnerId]);

  const updateApp = useCallback(async (appId: string, payload: Partial<CreateAppPayload>): Promise<boolean> => {
    setSaving(true);
    const res = await patchRequest(ROUTES.partners.organizationApp(partnerId, appId), payload, {
      errorMessage: 'Unable to update app.',
    });
    setSaving(false);
    if (res?.success) {
      const updated = res.data?.app ?? res.data;
      setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, ...updated } : a)));
      return true;
    }
    Alert.alert('Error', res?.message || 'Failed to update app.');
    return false;
  }, [partnerId]);

  const deleteApp = useCallback(async (appId: string): Promise<boolean> => {
    setSaving(true);
    const res = await deleteRequest(ROUTES.partners.organizationApp(partnerId, appId), {
      errorMessage: 'Unable to delete app.',
    });
    setSaving(false);
    if (res?.success || res?.status === 204) {
      setApps((prev) => prev.filter((a) => a.id !== appId));
      return true;
    }
    Alert.alert('Error', res?.message || 'Failed to delete app.');
    return false;
  }, [partnerId]);

  const loadTabs = useCallback(async (appId: string): Promise<AppBuilderTab[]> => {
    const res = await getRequest(ROUTES.partners.organizationAppTabs(partnerId, appId));
    return Array.isArray(res?.data?.tabs) ? res.data.tabs : [];
  }, [partnerId]);

  const createTab = useCallback(async (appId: string, payload: CreateTabPayload): Promise<AppBuilderTab | null> => {
    setSaving(true);
    const res = await postRequest(ROUTES.partners.organizationAppTabs(partnerId, appId), payload, {
      errorMessage: 'Unable to create tab.',
    });
    setSaving(false);
    if (res?.success) return res.data?.tab ?? res.data;
    Alert.alert('Error', res?.message || 'Failed to create tab.');
    return null;
  }, [partnerId]);

  const updateTab = useCallback(async (appId: string, tabId: string, payload: Partial<CreateTabPayload>): Promise<boolean> => {
    setSaving(true);
    const res = await patchRequest(ROUTES.partners.organizationAppTab(partnerId, appId, tabId), payload, {
      errorMessage: 'Unable to update tab.',
    });
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Error', res?.message || 'Failed to update tab.');
      return false;
    }
    return true;
  }, [partnerId]);

  const deleteTab = useCallback(async (appId: string, tabId: string): Promise<boolean> => {
    setSaving(true);
    const res = await deleteRequest(ROUTES.partners.organizationAppTab(partnerId, appId, tabId), {
      errorMessage: 'Unable to delete tab.',
    });
    setSaving(false);
    if (res?.success || res?.status === 204) return true;
    Alert.alert('Error', res?.message || 'Failed to delete tab.');
    return false;
  }, [partnerId]);

  const loadBlocks = useCallback(async (appId: string, tabId: string): Promise<AppBuilderBlock[]> => {
    const res = await getRequest(ROUTES.partners.organizationAppTabBlocks(partnerId, appId, tabId));
    return Array.isArray(res?.data?.blocks) ? res.data.blocks : [];
  }, [partnerId]);

  const createBlock = useCallback(async (appId: string, tabId: string, payload: CreateBlockPayload): Promise<AppBuilderBlock | null> => {
    setSaving(true);
    const res = await postRequest(ROUTES.partners.organizationAppTabBlocks(partnerId, appId, tabId), payload, {
      errorMessage: 'Unable to create block.',
    });
    setSaving(false);
    if (res?.success) return res.data?.block ?? res.data;
    Alert.alert('Error', res?.message || 'Failed to create block.');
    return null;
  }, [partnerId]);

  const updateBlock = useCallback(async (appId: string, tabId: string, blockId: string, payload: Partial<CreateBlockPayload>): Promise<boolean> => {
    setSaving(true);
    const res = await patchRequest(ROUTES.partners.organizationAppBlock(partnerId, appId, tabId, blockId), payload, {
      errorMessage: 'Unable to update block.',
    });
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Error', res?.message || 'Failed to update block.');
      return false;
    }
    return true;
  }, [partnerId]);

  const deleteBlock = useCallback(async (appId: string, tabId: string, blockId: string): Promise<boolean> => {
    setSaving(true);
    const res = await deleteRequest(ROUTES.partners.organizationAppBlock(partnerId, appId, tabId, blockId), {
      errorMessage: 'Unable to delete block.',
    });
    setSaving(false);
    if (res?.success || res?.status === 204) return true;
    Alert.alert('Error', res?.message || 'Failed to delete block.');
    return false;
  }, [partnerId]);

  return {
    apps,
    loading,
    saving,
    error,
    loadApps,
    createApp,
    updateApp,
    deleteApp,
    loadTabs,
    createTab,
    updateTab,
    deleteTab,
    loadBlocks,
    createBlock,
    updateBlock,
    deleteBlock,
  };
}
