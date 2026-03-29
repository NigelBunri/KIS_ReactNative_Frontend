import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import { RootStackParamList } from '@/navigation/types';
import {
  getHealthThemeBorders,
  getHealthThemeColors,
  HEALTH_THEME_SPACING,
  HEALTH_THEME_TYPOGRAPHY,
} from '@/theme/health';
import type {
  HealthDashboardInstitutionType,
  ServiceDefinition,
} from '@/features/health-dashboard/models';
import { HEALTH_DASHBOARD_DEFAULT_SERVICES } from '@/features/health-dashboard/defaults';
import {
  blocksHealthServiceMapping,
  filterHealthEngineNames,
  HEALTH_ENGINE_CONTACT_NOTICE,
  isComingSoonHealthEngineName,
  isRemovedHealthEngineName,
  sanitizeServiceEngineFields,
  sanitizeServiceList,
} from '@/features/health-dashboard/serviceCatalogPolicy';
import { fetchHealthProfileState } from '@/services/healthProfileService';
import {
  ensureInstitutionDashboardExists,
  fetchInstitutionServices,
  updateInstitutionServices,
} from '@/services/healthDashboardService';
import { nanoid } from 'nanoid/non-secure';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import EngineModal from './HealthEnginesDashboads/EngineModal';


type EngineData = {
  id: string;
  name: string;
  description: string;
  system_flag: boolean;
};

type Props = NativeStackScreenProps<RootStackParamList, 'HealthInstitutionServicesCatalog'>;
type MediumRow = {
  id: string;
  name: string;
  description: string;
  system_flag: boolean;
};
type ServiceApiRow = {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  medium_ids: string[];
  medium_links?: Array<{
    medium?: {
      id?: string;
      name?: string;
    };
  }>;
};

type BookNowAction = {
  id: string;
  label: string;
  run: () => void | Promise<void>;
};
type ViewerRole = 'owner' | 'admin' | 'manager' | 'staff' | 'analyst' | 'member' | 'unassigned';
type EngineKey =
  | 'appointment'
  | 'video'
  | 'lab'
  | 'prescription'
  | 'payment'
  | 'surgery'
  | 'admission'
  | 'emergency'
  | 'wellness'
  | 'logistics';
type EngineExecutionRow = {
  id: string;
  engine: EngineKey | string;
  service_id?: string;
  service_name?: string;
  status?: string;
  created_at?: string;
};
type PreviewCardRow = {
  id: string;
  date: string;
  time: string;
  statusKey: string;
  statusLabel: string;
  serviceId: string;
  serviceName: string;
  serviceDescription: string;
  basePriceCents?: number;
};

const SUPPORTED_TYPES: HealthDashboardInstitutionType[] = [
  'clinic',
  'hospital',
  'lab',
  'diagnostics',
  'pharmacy',
  'wellness_center',
];

const normalizeInstitutionType = (value: string | undefined): HealthDashboardInstitutionType => {
  const raw = String(value ?? '').trim();
  if (raw === 'laboratory') return 'lab';
  if (raw === 'diagnostics_center') return 'diagnostics';
  return SUPPORTED_TYPES.includes(raw as HealthDashboardInstitutionType)
    ? (raw as HealthDashboardInstitutionType)
    : 'clinic';
};

const extractServiceRows = (payload: any, preferredKeys: string[]): any[] => {
  const queue: any[] = [payload];
  const visited = new Set<any>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (Array.isArray(current)) return current;
    if (typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const key of preferredKeys) {
      const candidate = current?.[key];
      if (Array.isArray(candidate)) return candidate;
      if (candidate && typeof candidate === 'object') {
        queue.push(candidate);
      }
    }

    const nestedKeys = ['data', 'payload', 'result', 'response'];
    nestedKeys.forEach((key) => {
      const nested = current?.[key];
      if (nested && typeof nested === 'object') {
        queue.push(nested);
      }
    });
  }

  return [];
};

const normalizeServiceRow = (raw: any, index: number): ServiceDefinition | null => {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? raw.service_id ?? raw.key ?? `service_${index + 1}`).trim();
  const name = String(raw.name ?? raw.title ?? raw.label ?? '').trim();
  if (!name) return null;
  const description = String(raw.description ?? raw.summary ?? '').trim();
  const mediumIdsSource = raw.mediumIds ?? raw.medium_ids;
  const mediumNamesSource = raw.mediumNames ?? raw.medium_names;
  return sanitizeServiceEngineFields({
    id,
    name,
    description,
    active: raw.active !== false,
    basePriceCents: Number.isFinite(Number(raw.basePriceCents))
      ? Number(raw.basePriceCents)
      : Number.isFinite(Number(raw.base_price_cents))
      ? Number(raw.base_price_cents)
      : undefined,
    mediumIds: Array.isArray(mediumIdsSource) ? mediumIdsSource.map((item: any) => String(item || '').trim()).filter(Boolean) : [],
    mediumNames: Array.isArray(mediumNamesSource) ? mediumNamesSource.map((item: any) => String(item || '').trim()).filter(Boolean) : [],
  });
};

const normalizeHealthOpsServiceRow = (raw: any, index: number): ServiceDefinition | null => {
  if (!raw || typeof raw !== 'object') return null;
  const source =
    raw?.service && typeof raw.service === 'object'
      ? { ...raw, ...raw.service }
      : raw;
  const id = String(
    source.id ??
      source.service_id ??
      source.serviceId ??
      source.key ??
      source.slug ??
      `service_${index + 1}`,
  ).trim();
  const name = String(source.name ?? source.title ?? source.label ?? '').trim();
  if (!id || !name) return null;
  const description = String(source.description ?? source.summary ?? '').trim();
  const baseCostMicro = Number(
    source.base_cost_micro ??
      source.baseCostMicro ??
      source.amount_micro ??
      source.amountMicro,
  );
  const mediumIdsSource =
    source.medium_ids ??
    source.mediumIds ??
    source.engine_ids ??
    source.engineIds;
  const mediumNamesSource =
    source.medium_names ??
    source.mediumNames ??
    source.engine_names ??
    source.engineNames;
  return sanitizeServiceEngineFields({
    id,
    name,
    description,
    active: source.is_active !== false && source.active !== false,
    basePriceCents: Number.isFinite(baseCostMicro) ? Math.max(0, Math.round(baseCostMicro / 10)) : undefined,
    mediumIds: Array.isArray(mediumIdsSource) ? mediumIdsSource.map((item: any) => String(item || '').trim()).filter(Boolean) : [],
    mediumNames: Array.isArray(mediumNamesSource) ? mediumNamesSource.map((item: any) => String(item || '').trim()).filter(Boolean) : [],
  });
};

const resolveInstitutionServices = (institution: any): ServiceDefinition[] => {
  const candidates = [
    institution?.services,
    institution?.service_templates,
    institution?.serviceTemplates,
    institution?.dashboard?.services,
  ];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    const mapped = candidate
      .map((entry, index) => normalizeServiceRow(entry, index))
      .filter(Boolean) as ServiceDefinition[];
    if (mapped.length > 0) return mapped;
  }
  return [];
};

const money = (amountCents?: number) =>
  Number.isFinite(Number(amountCents))
    ? `${(Number(amountCents) / 10000).toFixed(3).replace(/\.?0+$/, '')} KISC`
    : null;

const toKisc = (micro?: number) => {
  if (!Number.isFinite(Number(micro))) return '0.000';
  return (Number(micro) / 100000).toFixed(3);
};

const normalizeViewerRole = (value: unknown): ViewerRole => {
  const role = String(value || '').trim().toLowerCase();
  if (
    role === 'owner' ||
    role === 'admin' ||
    role === 'manager' ||
    role === 'staff' ||
    role === 'analyst' ||
    role === 'member' ||
    role === 'unassigned'
  ) {
    return role;
  }
  return 'unassigned';
};

const normalizeEngineName = (value: string) => value.trim().toLowerCase();

const ENGINE_ICON_BY_NAME: Record<string, 'calendar' | 'video' | 'chat' | 'file' | 'cart' | 'bell' | 'heart' | 'list'> = {
  'appointment engine': 'calendar',
  'video consultation engine': 'video',
  'secure messaging / chat engine': 'chat',
  'e-prescription engine': 'file',
  'lab order engine': 'file',
  'imaging order engine': 'list',
  'admission & bed management engine': 'list',
  'surgery scheduling engine': 'calendar',
  'emergency dispatch engine': 'bell',
  'pharmacy & fulfillment engine': 'cart',
  'payment & billing engine': 'cart',
  'ehr / health records engine': 'file',
  'home logistics engine': 'list',
  'wellness program engine': 'heart',
  'notification & reminder engine': 'bell',
};

const ENGINE_NAME_TO_FLOW_KEY: Record<string, string> = {
  'appointment engine': 'appointment',
  'video consultation engine': 'video',
  'secure messaging / chat engine': 'messaging',
  'e-prescription engine': 'pharmacy',
  'lab order engine': 'clinical',
  'imaging order engine': 'clinical',
  'admission & bed management engine': 'admission',
  'surgery scheduling engine': 'admission',
  'emergency dispatch engine': 'emergency',
  'pharmacy & fulfillment engine': 'pharmacy',
  'payment & billing engine': 'billing',
  'ehr / health records engine': 'clinical',
  'home logistics engine': 'home_logistics',
  'wellness program engine': 'wellness',
  'notification & reminder engine': 'reminder',
};

const resolveEngineFlowKeysFromMediumNames = (mediumNames: string[]): string[] =>
  Array.from(
    new Set(
      mediumNames
        .map((name) => ENGINE_NAME_TO_FLOW_KEY[normalizeEngineName(name)])
        .filter((value): value is string => !!value),
    ),
  );

export default function InstitutionServicesCatalogScreen({ navigation, route }: Props) {
  const { institutionId, institutionName: routeName, institutionType: routeType } = route.params;
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const borders = getHealthThemeBorders(palette);
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [loading, setLoading] = useState(true);
  const [institutionName, setInstitutionName] = useState(routeName || 'Institution');
  const [institutionType, setInstitutionType] = useState<HealthDashboardInstitutionType>(
    normalizeInstitutionType(routeType),
  );
  const [services, setServices] = useState<ServiceDefinition[]>([]);
  const [saving, setSaving] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDescription, setNewServiceDescription] = useState('');
  const [mediums, setMediums] = useState<MediumRow[]>([]);
  const [mediumLoading, setMediumLoading] = useState(false);
  const [apiServices, setApiServices] = useState<ServiceApiRow[]>([]);
  const [, setServiceLoading] = useState(false);
  const [newServiceMediumIds, setNewServiceMediumIds] = useState<string[]>([]);
  const [bookNowActions, setBookNowActions] = useState<BookNowAction[]>([]);
  const [bookNowServiceName, setBookNowServiceName] = useState('');
  const [engineExecutions, setEngineExecutions] = useState<EngineExecutionRow[]>([]);
  const [viewerRole, setViewerRole] = useState<ViewerRole>('unassigned');
  const [previewCards, setPreviewCards] = useState<PreviewCardRow[]>([]);
  const [selectedEngine, setSelectedEngine] = useState<EngineData | null>(null);

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const profileState = await fetchHealthProfileState();
      const institutionList = Array.isArray(profileState.profile?.institutions)
        ? profileState.profile.institutions
        : [];
      const institution = institutionList.find((item: any) => String(item?.id) === String(institutionId));
      const resolvedType = normalizeInstitutionType(institution?.type ?? routeType);
      const customServices = resolveInstitutionServices(institution);
      const fallbackServices = HEALTH_DASHBOARD_DEFAULT_SERVICES[resolvedType];
      await ensureInstitutionDashboardExists(institutionId, resolvedType);
      const [dashboardServicesRes, dashboardServicesRawRes, healthOpsServicesRes] = await Promise.all([
        fetchInstitutionServices(institutionId),
        getRequest(ROUTES.healthDashboard.services(institutionId), {
          errorMessage: 'Unable to load institution services.',
        }),
        getRequest(ROUTES.healthOps.institutionServices(institutionId), {
          errorMessage: 'Unable to load institution services.',
        }),
      ]);
      const dashboardServiceRows = [
        ...extractServiceRows(dashboardServicesRes, ['services', 'results', 'items']),
        ...extractServiceRows(dashboardServicesRawRes, ['services', 'results', 'items']),
      ];
      const dashboardServices = dashboardServiceRows
        .map((row: any, index: number) => normalizeServiceRow(row, index))
        .filter(Boolean) as ServiceDefinition[];
      const healthOpsServiceRows = extractServiceRows(healthOpsServicesRes, ['results', 'services', 'items']);
      const healthOpsServices = healthOpsServiceRows
        .map((row: any, index: number) => normalizeHealthOpsServiceRow(row, index))
        .filter(Boolean) as ServiceDefinition[];

      const mergedMap = new Map<string, ServiceDefinition>();
      [...fallbackServices, ...customServices, ...dashboardServices, ...healthOpsServices].forEach((service) => {
        const serviceId = String(service?.id || '').trim();
        if (!serviceId) return;
        const existing = mergedMap.get(serviceId);
        mergedMap.set(serviceId, {
          ...existing,
          ...service,
          id: serviceId,
          name: String(service?.name || existing?.name || '').trim() || existing?.name || 'Health Service',
          description: String(service?.description || existing?.description || '').trim(),
          mediumIds: Array.from(
            new Set([
              ...((existing?.mediumIds || []).map((item) => String(item || '').trim()).filter(Boolean)),
              ...((service?.mediumIds || []).map((item) => String(item || '').trim()).filter(Boolean)),
            ]),
          ),
          mediumNames: Array.from(
            new Set([
              ...((existing?.mediumNames || []).map((item) => String(item || '').trim()).filter(Boolean)),
              ...((service?.mediumNames || []).map((item) => String(item || '').trim()).filter(Boolean)),
            ]),
          ),
        });
      });

      setInstitutionName(institution?.name || routeName || 'Institution');
      setInstitutionType(resolvedType);
      setServices(sanitizeServiceList(Array.from(mergedMap.values())));
    } catch (error: any) {
      Alert.alert('Services page', error?.message || 'Unable to load institution services.');
      const fallbackType = normalizeInstitutionType(routeType);
      setInstitutionType(fallbackType);
      setServices(HEALTH_DASHBOARD_DEFAULT_SERVICES[fallbackType]);
    } finally {
      setLoading(false);
    }
  }, [institutionId, routeName, routeType]);

  const loadMediums = useCallback(async () => {
    setMediumLoading(true);
    try {
      const [mediumRes, cardsRes] = await Promise.all([
        getRequest(ROUTES.broadcasts.healthMediums, {
          errorMessage: 'Unable to load engines.',
        }),
        getRequest(ROUTES.broadcasts.healthCards(institutionId), {
          errorMessage: 'Unable to load engine activity.',
        }),
      ]);

      if (mediumRes?.success) {
        const rows = Array.isArray(mediumRes?.data?.results) ? mediumRes.data.results : [];
        setMediums(
          rows
            .map((row: any) => ({
              id: String(row?.id || ''),
              name: String(row?.name || ''),
              description: String(row?.description || ''),
              system_flag: !!row?.system_flag,
            }))
            .filter((medium: MediumRow) => !isRemovedHealthEngineName(medium.name)),
        );
      }
      const viewer = cardsRes?.data?.viewer ?? {};
      setViewerRole(normalizeViewerRole(viewer?.role));
      const rawCards = Array.isArray(cardsRes?.data?.cards) ? cardsRes.data.cards : [];
      const normalizedCards: PreviewCardRow[] = rawCards
        .map((row: any, index: number) => {
          const service = row?.service && typeof row.service === 'object' ? row.service : {};
          const serviceId = String(service?.id || '').trim();
          const serviceName = String(service?.name || '').trim();
          if (!serviceId || !serviceName) return null;
          const centsRaw = service?.basePriceCents ?? service?.base_price_cents;
          const basePriceCents = Number.isFinite(Number(centsRaw)) ? Number(centsRaw) : undefined;
          return {
            id: String(row?.id || `preview-${index + 1}`),
            date: String(row?.date || row?.dateKey || ''),
            time: String(row?.time || row?.timeValue || ''),
            statusKey: String(row?.statusKey || 'available'),
            statusLabel: String(row?.statusLabel || 'Available'),
            serviceId,
            serviceName,
            serviceDescription: String(service?.description || ''),
            basePriceCents,
          } as PreviewCardRow;
        })
        .filter(Boolean) as PreviewCardRow[];
      normalizedCards.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
      setPreviewCards(normalizedCards);

      const executionRows = Array.isArray(cardsRes?.data?.engine_executions)
        ? cardsRes.data.engine_executions
        : [];
      setEngineExecutions(
        executionRows.slice(0, 20).map((row: any, index: number) => ({
          id: String(row?.id || `engine-${index + 1}`),
          engine: String(row?.engine || ''),
          service_id: String(row?.service_id || row?.serviceId || ''),
          service_name: String(row?.service_name || row?.serviceName || ''),
          status: String(row?.status || ''),
          created_at: String(row?.created_at || row?.createdAt || ''),
        })),
      );
    } catch (error: any) {
      Alert.alert('Engines', error?.message || 'Unable to load engine settings.');
    } finally {
      setMediumLoading(false);
    }
  }, [institutionId]);

  const loadServiceCatalog = useCallback(async () => {
    setServiceLoading(true);
    try {
      const response = await getRequest(ROUTES.broadcasts.healthServices, {
        errorMessage: 'Unable to load service-engine mappings.',
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to load service catalog.');
      }
      const rows = Array.isArray(response?.data?.results) ? response.data.results : [];
      setApiServices(
        rows.map((row: any) => ({
          id: String(row?.id || ''),
          name: String(row?.name || ''),
          description: String(row?.description || ''),
          is_default: !!row?.is_default,
          medium_ids: Array.isArray(row?.medium_ids) ? row.medium_ids.map((id: any) => String(id)) : [],
          medium_links: Array.isArray(row?.medium_links) ? row.medium_links : [],
        })),
      );
    } catch (error: any) {
      Alert.alert('Services', error?.message || 'Unable to load service catalog.');
    } finally {
      setServiceLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices().catch(() => {});
  }, [loadServices]);

  useEffect(() => {
    loadMediums().catch(() => {});
  }, [loadMediums]);

  useEffect(() => {
    loadServiceCatalog().catch(() => {});
  }, [loadServiceCatalog]);

  const activeCount = useMemo(
    () => services.filter((service) => service.active !== false).length,
    [services],
  );

  const defaultServiceIdSet = useMemo(
    () => new Set(HEALTH_DASHBOARD_DEFAULT_SERVICES[institutionType].map((service) => service.id)),
    [institutionType],
  );

  const assignableMediums = useMemo(
    () => mediums.filter((medium) => !blocksHealthServiceMapping(medium.name)),
    [mediums],
  );

  const hasComingSoonEngines = useMemo(
    () => mediums.some((medium) => isComingSoonHealthEngineName(medium.name)),
    [mediums],
  );

  const serviceMediumNamesByName = useMemo(() => {
    const out = new Map<string, string[]>();
    apiServices.forEach((service) => {
      const mediumNames = filterHealthEngineNames((service.medium_links || [])
        .map((link) => String(link?.medium?.name || '').trim())
        .filter(Boolean));
      if (mediumNames.length > 0) {
        out.set(service.name.trim().toLowerCase(), mediumNames);
      }
    });
    return out;
  }, [apiServices]);

  const persistServices = useCallback(
    async (nextServices: ServiceDefinition[]) => {
      const cleanedServices = sanitizeServiceList(nextServices);
      const payload = {
        services: cleanedServices.map((service) => ({
          id: String(service.id || '').trim(),
          name: String(service.name || '').trim(),
          description: String(service.description || '').trim(),
          active: service.active !== false,
          basePriceCents:
            Number.isFinite(Number(service.basePriceCents)) && Number(service.basePriceCents) >= 0
              ? Number(service.basePriceCents)
              : undefined,
          mediumIds: Array.isArray(service.mediumIds)
            ? service.mediumIds.map((id) => String(id || '').trim()).filter(Boolean)
            : [],
          mediumNames: Array.isArray(service.mediumNames)
            ? service.mediumNames.map((name) => String(name || '').trim()).filter(Boolean)
            : [],
        })),
      };
      const res = await updateInstitutionServices(institutionId, payload);
      if (!res?.success) {
        throw new Error(res?.message || 'Unable to update services.');
      }
      const normalized = Array.isArray(res?.data?.services)
        ? res.data.services
            .map((row: any, index: number) => normalizeServiceRow(row, index))
            .filter(Boolean) as ServiceDefinition[]
        : [];
      setServices(normalized.length > 0 ? normalized : cleanedServices);
    },
    [institutionId],
  );

  const toggleServiceActive = useCallback(
    async (serviceId: string) => {
      if (saving) return;
      setSaving(true);
      try {
        const next = services.map((service) =>
          service.id === serviceId ? { ...service, active: service.active === false } : service,
        );
        await persistServices(next);
      } catch (error: any) {
        Alert.alert('Services', error?.message || 'Unable to update service.');
      } finally {
        setSaving(false);
      }
    },
    [persistServices, saving, services],
  );

  const deleteCustomService = useCallback(
    async (serviceId: string) => {
      if (saving) return;
      if (defaultServiceIdSet.has(serviceId)) {
        Alert.alert('Services', 'Default services cannot be deleted.');
        return;
      }
      setSaving(true);
      try {
        if (!serviceId.startsWith('custom_')) {
          const url = `${ROUTES.broadcasts.healthService(serviceId)}?institution_id=${encodeURIComponent(institutionId)}`;
          const response = await deleteRequest(url, {
            errorMessage: 'Unable to delete service mapping.',
          });
          if (!response?.success && Number(response?.status) !== 404) {
            throw new Error(response?.message || 'Unable to delete service mapping.');
          }
        }
        const next = services.filter((service) => service.id !== serviceId);
        await persistServices(next);
        await loadServiceCatalog();
      } catch (error: any) {
        Alert.alert('Services', error?.message || 'Unable to delete service.');
      } finally {
        setSaving(false);
      }
    },
    [defaultServiceIdSet, institutionId, loadServiceCatalog, persistServices, saving, services],
  );

  const addCustomService = useCallback(async () => {
    if (saving) return;
    const name = newServiceName.trim();
    const description = newServiceDescription.trim();
    if (!name) {
      Alert.alert('Services', 'Service name is required.');
      return;
    }
    if (newServiceMediumIds.length === 0) {
      Alert.alert('Services', 'Select at least one engine for this service.');
      return;
    }
    setSaving(true);
    try {
      const createResponse = await postRequest(
        ROUTES.broadcasts.healthServices,
        {
          institution_id: institutionId,
          name,
          description,
          medium_ids: newServiceMediumIds,
        },
        { errorMessage: 'Unable to create service.' },
      );
      if (!createResponse?.success) {
        throw new Error(createResponse?.message || 'Unable to create service.');
      }
      const created = createResponse?.data?.service ?? {};
      const createdServiceId = String(created?.id || `custom_${nanoid(10)}`);
      const selectedMediumNames = assignableMediums
        .filter((medium) => newServiceMediumIds.includes(medium.id))
        .map((medium) => medium.name);
      const next: ServiceDefinition[] = [
        ...services,
        {
          id: createdServiceId,
          name,
          description,
          active: true,
          mediumIds: [...newServiceMediumIds],
          mediumNames: selectedMediumNames,
        },
      ];
      await persistServices(next);
      setNewServiceName('');
      setNewServiceDescription('');
      setNewServiceMediumIds([]);
      await loadServiceCatalog();
    } catch (error: any) {
      Alert.alert('Services', error?.message || 'Unable to add service.');
    } finally {
      setSaving(false);
    }
  }, [assignableMediums, institutionId, loadServiceCatalog, newServiceDescription, newServiceMediumIds, newServiceName, persistServices, saving, services]);

  const resolveServiceMediumNames = useCallback(
    (service: ServiceDefinition) => {
      if (Array.isArray(service.mediumNames) && service.mediumNames.length > 0) {
        return filterHealthEngineNames(service.mediumNames);
      }
      return filterHealthEngineNames(serviceMediumNamesByName.get(service.name.trim().toLowerCase()) || []);
    },
    [serviceMediumNamesByName],
  );

  const handleBookNow = useCallback(
    (service: ServiceDefinition) => {
      const mediumNames = resolveServiceMediumNames(service);
      if (mediumNames.length === 0) {
        Alert.alert('Book Now', 'No engine is attached to this service yet.');
        return;
      }

      const normalized = new Set(mediumNames.map(normalizeEngineName));
      const actions: BookNowAction[] = [];
      const executeEngine = async (engine: EngineKey) => {
        const response = await postRequest(
          ROUTES.broadcasts.healthCards(institutionId),
          {
            action: 'execute_engine',
            engine,
            serviceId: service.id,
            serviceName: service.name,
            mediumNames,
          },
          { errorMessage: `Unable to execute ${engine} engine.` },
        );
        if (response?.success) {
          const rows = Array.isArray(response?.data?.engine_executions)
            ? response.data.engine_executions
            : [];
          setEngineExecutions(
            rows.slice(0, 20).map((row: any, index: number) => ({
              id: String(row?.id || `engine-${index + 1}`),
              engine: String(row?.engine || ''),
              service_id: String(row?.service_id || row?.serviceId || ''),
              service_name: String(row?.service_name || row?.serviceName || ''),
              status: String(row?.status || ''),
              created_at: String(row?.created_at || row?.createdAt || ''),
            })),
          );
        }
      };

      if (normalized.has('appointment engine')) {
        actions.push({
          id: 'appointment',
          label: 'Open Booking',
          run: async () => {
            await executeEngine('appointment');
            navigation.navigate('AvailabilityManagement', {
              institutionId,
              institutionType,
            });
          },
        });
      }
      if (normalized.has('video consultation engine')) {
        actions.push({
          id: 'video',
          label: 'Schedule Video',
          run: async () => {
            await executeEngine('video');
            navigation.navigate('AvailabilityManagement', {
              institutionId,
              institutionType,
            });
          },
        });
      }
      if (normalized.has('lab order engine')) {
        actions.push({
          id: 'lab',
          label: 'Open Lab Selector',
          run: async () => {
            await executeEngine('lab');
            navigation.navigate('HealthInstitutionCards', {
              institutionId,
              institutionType,
              institutionName,
            });
          },
        });
      }
      if (normalized.has('e-prescription engine')) {
        actions.push({
          id: 'rx',
          label: 'Open Prescription',
          run: async () => {
            await executeEngine('prescription');
            navigation.navigate('HealthInstitutionCards', {
              institutionId,
              institutionType,
              institutionName,
            });
          },
        });
      }
      if (normalized.has('payment & billing engine')) {
        actions.push({
          id: 'billing',
          label: 'Open Billing',
          run: async () => {
            await executeEngine('payment');
            Alert.alert(
              'Payment & Billing',
              money(service.basePriceCents)
                ? `Consultation charge starts at ${money(service.basePriceCents)}.`
                : 'Payment workflow is ready for this service.',
            );
          },
        });
      }
      if (normalized.has('surgery scheduling engine')) {
        actions.push({
          id: 'surgery',
          label: 'Schedule Surgery',
          run: async () => {
            await executeEngine('surgery');
            navigation.navigate('AvailabilityManagement', {
              institutionId,
              institutionType,
            });
          },
        });
      }
      if (normalized.has('admission & bed management engine')) {
        actions.push({
          id: 'admission',
          label: 'Open Admission',
          run: async () => {
            await executeEngine('admission');
            navigation.navigate('HealthInstitutionCards', {
              institutionId,
              institutionType,
              institutionName,
            });
          },
        });
      }
      if (normalized.has('emergency dispatch engine')) {
        actions.push({
          id: 'emergency',
          label: 'Dispatch Emergency',
          run: async () => {
            await executeEngine('emergency');
            Alert.alert('Emergency Dispatch', 'Emergency workflow has been triggered for this service.');
          },
        });
      }
      if (normalized.has('wellness program engine')) {
        actions.push({
          id: 'wellness',
          label: 'Open Wellness',
          run: async () => {
            await executeEngine('wellness');
            navigation.navigate('HealthInstitutionCards', {
              institutionId,
              institutionType,
              institutionName,
            });
          },
        });
      }
      if (normalized.has('home logistics engine')) {
        actions.push({
          id: 'logistics',
          label: 'Start Logistics',
          run: async () => {
            await executeEngine('logistics');
            Alert.alert('Home Logistics', 'Home logistics workflow has been started.');
          },
        });
      }

      if (actions.length === 0) {
        actions.push({
          id: 'generic',
          label: 'Open Service',
          run: () => Alert.alert('Book Now', 'Service engine action opened.'),
        });
      }

      if (actions.length === 1) {
        Promise.resolve(actions[0].run()).catch(() => undefined);
        return;
      }

      setBookNowServiceName(service.name);
      setBookNowActions(actions);
    },
    [institutionId, institutionName, institutionType, navigation, resolveServiceMediumNames],
  );

  const isOwnerViewer = viewerRole === 'owner';

  const handleOwnerPreview = useCallback(
    async (service: ServiceDefinition) => {
      if (!isOwnerViewer) {
        Alert.alert('Owner preview', 'Only the institution owner can run free preview flows.');
        return;
      }

      const candidate =
        previewCards.find(
          (row) =>
            String(row.serviceId) === String(service.id) &&
            String(row.statusKey || '').toLowerCase() !== 'blocked' &&
            String(row.statusKey || '').toLowerCase() !== 'holiday',
        ) || null;

      if (!candidate) {
        Alert.alert(
          'Owner preview',
          'No schedulable health card was found for this service yet. Set availability first, then retry.',
        );
        return;
      }

      try {
        const configuredEngineFlowKeys = resolveEngineFlowKeysFromMediumNames(resolveServiceMediumNames(service));
        navigation.navigate('HealthServiceSession', {
          institutionId,
          institutionType,
          institutionName,
          cardId: candidate.id,
          sessionSource: 'broadcasts',
          serviceId: service.id,
          serviceName: service.name,
          serviceDescription: service.description || candidate.serviceDescription,
          configuredEngineFlowKeys,
          dateKey: candidate.date,
          timeValue: candidate.time,
          statusLabel: candidate.statusLabel,
          basePriceCents: candidate.basePriceCents,
          ownerPreview: true,
        });
      } catch (error: any) {
        Alert.alert('Owner preview', error?.message || 'Unable to start owner preview.');
      }
    },
    [institutionId, institutionName, institutionType, isOwnerViewer, navigation, previewCards, resolveServiceMediumNames],
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ position: 'absolute', right: spacing.lg, top: spacing.lg }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 12,
                padding: spacing.xs,
                backgroundColor: palette.card,
              }}
              accessibilityLabel="Close services page"
            >
              <KISIcon name="close" size={18} color={palette.text} />
            </TouchableOpacity>
          </View>
          <ActivityIndicator size="large" color={palette.accentPrimary} />
          <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.sm }}>
            Loading services...
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={{ flex: 1 }}>
        <View style={{ alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 12,
              padding: spacing.xs,
              backgroundColor: palette.card,
            }}
            accessibilityLabel="Close services page"
          >
            <KISIcon name="close" size={18} color={palette.text} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
          <View
            style={{
              borderRadius: spacing.lg,
              padding: spacing.md,
              backgroundColor: palette.card,
              ...borders.card,
            }}
          >
            <Text style={{ ...typography.h2, color: palette.text }}>{institutionName} Services</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
              {institutionType.replace('_', ' ')} • {activeCount} active services
            </Text>
            {isOwnerViewer ? (
              <Text style={{ ...typography.caption, color: palette.accentPrimary, marginTop: spacing.xs }}>
                Owner preview is enabled. You can run engine flows without KIS charges from this catalog.
              </Text>
            ) : null}
            <View style={{ marginTop: spacing.sm }}>
              <KISButton title="Reload Services" variant="outline" onPress={loadServices} />
            </View>
          </View>

          <View
            style={{
              marginTop: spacing.lg,
              borderRadius: spacing.lg,
              padding: spacing.md,
              backgroundColor: palette.card,
              ...borders.card,
            }}
          >
            <Text style={{ ...typography.h3, color: palette.text }}>Engine Activity</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
              Latest engine executions for this institution.
            </Text>
            <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
              {engineExecutions.map((row) => (
                <View
                  key={`engine-${row.id}`}
                  style={{
                    borderRadius: spacing.sm,
                    borderWidth: 1,
                    borderColor: palette.divider,
                    backgroundColor: palette.surface,
                    padding: spacing.sm,
                  }}
                >
                  <Text style={{ ...typography.label, color: palette.text }}>
                    {String(row.engine || '').toUpperCase()} • {row.service_name || row.service_id || 'Service'}
                  </Text>
                  <Text style={{ ...typography.caption, color: palette.subtext, marginTop: 2 }}>
                    {row.status || 'executed'} {row.created_at ? `• ${row.created_at}` : ''}
                  </Text>
                </View>
              ))}
              {engineExecutions.length === 0 ? (
                <Text style={{ ...typography.body, color: palette.subtext }}>
                  No engine activity yet.
                </Text>
              ) : null}
            </View>
          </View>

          <View
            style={{
              marginTop: spacing.lg,
              borderRadius: spacing.lg,
              padding: spacing.md,
              backgroundColor: palette.card,
              ...borders.card,
            }}
          >
            <Text style={{ ...typography.h3, color: palette.text }}>Add Custom Service</Text>
            <KISTextInput
              label="Service name"
              value={newServiceName}
              onChangeText={setNewServiceName}
              style={{ marginTop: spacing.sm }}
            />
            <KISTextInput
              label="Description"
              value={newServiceDescription}
              onChangeText={setNewServiceDescription}
              style={{ marginTop: spacing.sm }}
            />
            <Text style={{ ...typography.label, color: palette.text, marginTop: spacing.sm }}>
              Select Engines (required)
            </Text>
            <Text style={{ ...typography.caption, color: palette.subtext, marginTop: spacing.xs }}>
              Coming-up engines stay in the catalog, but they cannot be attached to services yet.
            </Text>
            <View style={{ marginTop: spacing.xs, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {assignableMediums.map((medium) => {
                const selected = newServiceMediumIds.includes(medium.id);
                return (
                  <KISButton
                    key={medium.id}
                    title={medium.name}
                    size="xs"
                    variant={selected ? 'primary' : 'outline'}
                    onPress={() =>
                      setNewServiceMediumIds((prev) =>
                        prev.includes(medium.id)
                          ? prev.filter((id) => id !== medium.id)
                          : [...prev, medium.id],
                      )
                    }
                    disabled={saving}
                  />
                );
              })}
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <KISButton title={saving ? 'Saving...' : 'Add Service'} onPress={addCustomService} disabled={saving} />
            </View>
          </View>

          <View
            style={{
              marginTop: spacing.lg,
              borderRadius: spacing.lg,
              padding: spacing.md,
              backgroundColor: palette.card,
              ...borders.card,
            }}
          >
            <Text style={{ ...typography.h3, color: palette.text }}>Available Engines</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
              Engines are fixed system capabilities. Creating, editing, and deleting engines is disabled.
            </Text>
            {hasComingSoonEngines ? (
              <View
                style={{
                  marginTop: spacing.sm,
                  borderRadius: spacing.md,
                  borderWidth: 1,
                  borderColor: '#D97706',
                  backgroundColor: '#FEF3C7',
                  padding: spacing.sm,
                }}
              >
                <Text style={{ ...typography.label, color: '#9A3412' }}>
                  Some health engines are still coming up.
                </Text>
                <Text style={{ ...typography.body, color: '#7C2D12', marginTop: 4 }}>
                  {HEALTH_ENGINE_CONTACT_NOTICE}
                </Text>
              </View>
            ) : null}
            <View style={{ marginTop: spacing.sm }}>
              <KISButton
                title={mediumLoading ? 'Loading engines...' : 'Reload Engines'}
                variant="outline"
                onPress={() => loadMediums().catch(() => {})}
                disabled={mediumLoading}
              />
            </View>
            <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
              {mediums.map((medium) => (
                <View
                  key={medium.id}
                  style={{
                    borderRadius: spacing.sm,
                    borderWidth: 1,
                    borderColor: palette.divider,
                    backgroundColor: palette.surface,
                    padding: spacing.sm,
                    marginBottom: spacing.md, // optional spacing between items
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ ...typography.h3, color: palette.text, flex: 1 }}>
                      {medium.name}
                    </Text>
                    <KISButton
                      onPress={() => {
                        if (isComingSoonHealthEngineName(medium.name)) {
                          Alert.alert('Coming up', HEALTH_ENGINE_CONTACT_NOTICE);
                          return;
                        }
                        setSelectedEngine(medium);
                      }}
                      title={isComingSoonHealthEngineName(medium.name) ? 'Coming Up' : 'Manage'}
                      variant="outline"
                    />
                  </View>

                  {medium.description ? (
                    <Text
                      style={{
                        ...typography.body,
                        color: palette.subtext,
                        marginTop: spacing.xs,
                      }}
                    >
                      {medium.description}
                    </Text>
                  ) : null}
                  {isComingSoonHealthEngineName(medium.name) ? (
                    <View
                      style={{
                        marginTop: spacing.sm,
                        borderRadius: spacing.sm,
                        borderWidth: 1,
                        borderColor: '#DC2626',
                        backgroundColor: '#FEE2E2',
                        padding: spacing.sm,
                      }}
                    >
                      <Text style={{ ...typography.caption, color: '#991B1B' }}>
                        Coming up. {HEALTH_ENGINE_CONTACT_NOTICE}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
              {selectedEngine && (
                <EngineModal
                  visible={!!selectedEngine}
                  data={selectedEngine}
                  institutionId={institutionId}
                  onClose={() => setSelectedEngine(null)}
                />
              )}
              {mediums.length === 0 ? (
                <Text style={{ ...typography.body, color: palette.subtext }}>
                  No engines available.
                </Text>
              ) : null}
            </View>
          </View>

          <View
            style={{
              marginTop: spacing.lg,
              borderRadius: spacing.lg,
              padding: spacing.md,
              backgroundColor: palette.card,
              ...borders.card,
              gap: spacing.sm,
            }}
          >
            {services.map((service) => (
              <View
                key={service.id}
                style={{
                  borderRadius: spacing.sm,
                  borderWidth: 1,
                  borderColor: palette.divider,
                  backgroundColor: palette.surface,
                  padding: spacing.sm,
                }}
              >
                {(() => {
                  const mediumNames = resolveServiceMediumNames(service);
                  return mediumNames.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs }}>
                      {mediumNames.map((mediumName) => {
                        const iconName =
                          ENGINE_ICON_BY_NAME[normalizeEngineName(mediumName)] || 'list';
                        return (
                          <View
                            key={`${service.id}-${mediumName}`}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              borderWidth: 1,
                              borderColor: palette.divider,
                              borderRadius: 999,
                              paddingHorizontal: spacing.xs,
                              paddingVertical: 4,
                              backgroundColor: palette.card,
                            }}
                          >
                            <KISIcon name={iconName} size={13} color={palette.accentPrimary} />
                            <Text style={{ ...typography.caption, color: palette.text, marginLeft: 4 }}>
                              {mediumName}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null;
                })()}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ ...typography.h3, color: palette.text, flex: 1 }}>{service.name}</Text>
                  <Text style={{ ...typography.label, color: service.active ? palette.accentPrimary : palette.subtext }}>
                    {service.active ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </View>
                {service.description && (
                  <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
                    {service.description}
                  </Text>
                )}
                {resolveServiceMediumNames(service).length > 0 ? (
                  <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
                    Engines: {resolveServiceMediumNames(service).join(', ')}
                  </Text>
                ) : null}
                {money(service.basePriceCents) ? (
                  <Text style={{ ...typography.label, color: palette.text, marginTop: spacing.xs }}>
                    Starting at {money(service.basePriceCents)}
                  </Text>
                ) : null}
                <View style={{ marginTop: spacing.sm, flexDirection: 'column', gap: spacing.xs }}>
                  {isOwnerViewer ? (
                    <KISButton
                      title="Owner Preview"
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        handleOwnerPreview(service).catch(() => undefined);
                      }}
                      disabled={saving || service.active === false}
                    />
                  ) : null}
                  <KISButton
                    title="Book Now"
                    size="sm"
                    onPress={() => handleBookNow(service)}
                    disabled={saving || service.active === false}
                  />
                  <KISButton
                    title={service.active ? 'Deactivate' : 'Activate'}
                    size="sm"
                    variant={service.active ? 'outline' : 'primary'}
                    onPress={() => toggleServiceActive(service.id)}
                    disabled={saving}
                  />
                  {!defaultServiceIdSet.has(service.id) ? (
                    <KISButton
                      title="Delete"
                      size="sm"
                      variant="outline"
                      onPress={() => deleteCustomService(service.id)}
                      disabled={saving}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          {bookNowActions.length > 1 ? (
            <View
              style={{
                marginTop: spacing.lg,
                borderRadius: spacing.lg,
                padding: spacing.md,
                backgroundColor: palette.card,
                ...borders.card,
              }}
            >
              <Text style={{ ...typography.h3, color: palette.text }}>
                Book Now Options - {bookNowServiceName}
              </Text>
              <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
                Multiple engines are attached. Choose the workflow to continue.
              </Text>
              <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                {bookNowActions.map((action) => (
                  <KISButton
                    key={action.id}
                    title={action.label}
                    variant="outline"
                    onPress={() => {
                      Promise.resolve(action.run())
                        .catch(() => undefined)
                        .finally(() => {
                          setBookNowActions([]);
                          setBookNowServiceName('');
                        });
                    }}
                  />
                ))}
                <KISButton
                  title="Cancel"
                  variant="ghost"
                  onPress={() => {
                    setBookNowActions([]);
                    setBookNowServiceName('');
                  }}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
