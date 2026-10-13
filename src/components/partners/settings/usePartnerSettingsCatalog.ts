import { useEffect, useMemo, useState } from 'react';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import {
  PARTNER_SETTINGS_SECTIONS,
  PartnerFeature,
  PartnerRole,
  PartnerSettingsSection,
  normalizePartnerRole,
} from './partnerSettingsData';

type ApiFeature = {
  key: string;
  title: string;
  description: string;
  access?: string[];
  enabled?: boolean;
  allowed?: boolean;
};

type ApiSection = {
  key: string;
  title: string;
  description: string;
  features: ApiFeature[];
};

type ApiCatalog = {
  role?: string;
  sections?: ApiSection[];
};

const toRole = (value?: string | null): PartnerRole | null => {
  if (!value) return null;
  const role = value.toLowerCase();
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'manager') return 'manager';
  if (role === 'analyst') return 'analyst';
  if (role === 'member') return 'member';
  return null;
};

const mapFeature = (feature: ApiFeature): PartnerFeature => ({
  key: feature.key,
  title: feature.title,
  description: feature.description,
  access: (feature.access || []).map((role) => toRole(role)).filter(Boolean) as PartnerRole[],
  enabled: feature.enabled,
  allowed: feature.allowed,
});

const mapSection = (section: ApiSection): PartnerSettingsSection => ({
  key: section.key,
  title: section.title,
  description: section.description,
  features: (section.features || []).map(mapFeature),
});

export const usePartnerSettingsCatalog = (
  partnerId?: string | null,
  fallbackRole: PartnerRole = 'member',
  forceRole?: PartnerRole,
) => {
  const [sections, setSections] = useState<PartnerSettingsSection[]>(
    PARTNER_SETTINGS_SECTIONS,
  );
  const [role, setRole] = useState<PartnerRole>(forceRole ?? fallbackRole);
  const [loading, setLoading] = useState(false);
  // Falling back to the bundled default catalog on a failed fetch is the
  // right behavior offline, but it must not look identical to "this is the
  // real, role-accurate catalog from the server" — callers can use this to
  // show a quiet "showing defaults" notice instead of staying silent.
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (forceRole) {
      setRole(forceRole);
    }
  }, [forceRole]);

  useEffect(() => {
    if (!partnerId) return;
    let isMounted = true;
    setLoading(true);
    getRequest(ROUTES.partners.settingsCatalog(partnerId), {
      errorMessage: 'Unable to load partner settings.',
    })
      .then((res) => {
        const payload = (res?.data ?? res) as ApiCatalog;
        if (!isMounted) return;
        const apiSections = Array.isArray(payload?.sections) ? payload.sections : null;
        if (apiSections?.length) {
          setSections(apiSections.map(mapSection));
          setError(null);
        } else {
          setSections(PARTNER_SETTINGS_SECTIONS);
          // res.success === false means the request actually failed (vs. a
          // partner that legitimately has an empty catalog) — only that case
          // is worth telling the user the list they're seeing is the bundled
          // default, not what the server currently has configured.
          setError(res?.success === false ? (res?.message || 'Unable to load live settings.') : null);
        }
        // forceRole always wins — superadmin trumps whatever the API returns
        const nextRole = forceRole ?? normalizePartnerRole(payload?.role ?? null, fallbackRole);
        setRole(nextRole);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [partnerId, fallbackRole, forceRole]);

  const sectionMap = useMemo(() => {
    const map: Record<string, PartnerSettingsSection> = {};
    sections.forEach((section) => {
      map[section.key] = section;
    });
    return map;
  }, [sections]);

  return {
    sections,
    sectionMap,
    role,
    loading,
    error,
  };
};
