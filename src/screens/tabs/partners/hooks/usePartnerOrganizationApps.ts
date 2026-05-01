import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { ORGANIZATION_APPS_UPDATED_EVENT } from '@/constants/partnerOrganizationApps';

export type PartnerOrganizationApp = {
  id: string;
  partner_id?: string;
  name: string;
  slug?: string;
  type?: string;
  description?: string;
  link?: string | null;
  module?: string;
  metadata?: Record<string, any>;
  icon?: string | null;
  config?: Record<string, any>;
  is_active?: boolean;
  order?: number;
  created_at?: string;
  updated_at?: string;
  visible_to?: string[];
  badge_label?: string;
  group?: string;
  status?: string;
  is_promoted_global?: boolean;
  promoted_order?: number;
  published_at?: string | null;
  tabs?: PartnerOrganizationAppTab[];
};

export type PartnerOrganizationAppContentBlock = {
  id: string;
  tab?: string;
  block_type: 'text' | 'rich_text' | 'video' | 'image' | 'link' | 'file' | 'embed' | string;
  title?: string;
  body?: string;
  media_url?: string;
  payload?: Record<string, any>;
  order?: number;
  status?: string;
  is_active?: boolean;
  published_at?: string | null;
};

export type PartnerOrganizationAppTab = {
  id: string;
  app?: string;
  title: string;
  slug?: string;
  description?: string;
  icon?: string;
  order?: number;
  is_active?: boolean;
  visible_to?: string[];
  config?: Record<string, any>;
  content_blocks?: PartnerOrganizationAppContentBlock[];
};

export default function usePartnerOrganizationApps(partnerId?: string | null) {
  const [apps, setApps] = useState<PartnerOrganizationApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    if (!partnerId) {
      setApps([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.partners.organizationApps(partnerId), {
        errorMessage: 'Unable to load organization apps.',
      });
      const payload = res?.data?.apps ?? res?.data ?? [];
      const list = Array.isArray(payload) ? payload : [];
      setApps(list);
    } catch (err: any) {
      setError(err?.message || 'Unable to load organization apps.');
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  useEffect(() => {
    const listener = DeviceEventEmitter.addListener(
      ORGANIZATION_APPS_UPDATED_EVENT,
      () => {
        loadApps();
      },
    );
    return () => {
      listener.remove();
    };
  }, [loadApps]);

  const reload = useCallback(() => {
    loadApps();
  }, [loadApps]);

  return {
    apps,
    loading,
    error,
    reload,
  };
}
