import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HEALTH_THEME_SPACING } from "@/theme/health/spacing";
import { HEALTH_THEME_TYPOGRAPHY } from "@/theme/health/typography";
import { getHealthThemeColors } from "@/theme/health/colors";
import KISButton from "@/constants/KISButton";
import ROUTES from "@/network";
import { getRequest } from "@/network/get";
import { postRequest } from "@/network/post";
import { patchRequest } from "@/network/patch";
import {
  createInstitutionEngineManagedItem,
  fetchInstitutionEngineManagedItems,
  updateInstitutionEngineManagedItem,
} from "@/services/healthOpsEngineManagerService";

/* ================= TYPES ================= */

type StaffStatus = "Available" | "Busy" | "Offline";
type ServicePriority = "Normal" | "Urgent" | "Critical";
type ServiceStatus =
  | "Requested"
  | "Assigned"
  | "En Route"
  | "Completed"
  | "Cancelled";

type Staff = {
  id: string;
  name: string;
  role: string;
  status: StaffStatus;
};

type ServiceRequest = {
  id: string;
  patientName: string;
  location: string;
  type: string;
  priority: ServicePriority;
  assignedStaff?: string;
  status: ServiceStatus;
  price: number;
};

/* ================= HELPERS ================= */

const normalizeStaff = (raw: any): Staff => ({
  id: String(raw.id ?? ""),
  name: raw.name ?? raw.full_name ?? raw.staff_name ?? "Unknown",
  role: raw.role ?? raw.job_title ?? "Staff",
  status: (raw.status ?? "Available") as StaffStatus,
});

const normalizeRequest = (raw: any): ServiceRequest => ({
  id: String(raw.id ?? ""),
  patientName:
    raw.patient_name ??
    raw.patientName ??
    raw.patient?.name ??
    raw.patient?.full_name ??
    "Unknown",
  location: raw.location ?? raw.address ?? "",
  type: raw.type ?? raw.service_type ?? raw.visit_type ?? "",
  priority: (raw.priority ?? "Normal") as ServicePriority,
  assignedStaff: raw.assigned_staff ?? raw.assignedStaff,
  status: (raw.status ?? "Requested") as ServiceStatus,
  price: raw.price ?? raw.fee ?? 0,
});

/* ================= COMPONENT ================= */

type Props = { institutionId: string; engineKey: string };

export default function HomeLogisticsManager({ institutionId, engineKey }: Props) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === "light" ? "light" : "dark");
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  /* ================= CONFIG ================= */
  const [engineEnabled, setEngineEnabled] = useState(true);
  const [engineConfigItemId, setEngineConfigItemId] = useState<string | null>(null);
  const [defaultFee, setDefaultFee] = useState("200");
  const [autoAssign, setAutoAssign] = useState(true);
  const [maxActive, setMaxActive] = useState("10");

  /* ================= REMOTE DATA ================= */

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ================= FETCH ================= */

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // NOTE: there is no backend endpoint to list home-logistics service
      // requests for an institution yet — health-ops/home-logistics/sessions/start/
      // only supports POST (creating one session at a time). Requests created in
      // this session persist via the POST below, but won't be listed on reload
      // until a list endpoint exists. Only staff/fleet data is fetched here.
      const staffRes = await getRequest(ROUTES.core.staff, {});

      if (staffRes.success) {
        const data = staffRes.data;
        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
          ? data.results
          : [];
        setStaffList(list.map(normalizeStaff));
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load home logistics data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!institutionId || !engineKey) return;
    fetchInstitutionEngineManagedItems(institutionId, engineKey, { itemKind: 'engine_config' })
      .then((res: any) => {
        const rows = Array.isArray(res?.data?.results) ? res.data.results : [];
        const cfg = rows.find((r: any) => r?.name === 'is_active');
        if (cfg) {
          setEngineConfigItemId(String(cfg.id));
          setEngineEnabled(cfg.value_bool !== false);
        }
      })
      .catch(() => undefined);
  }, [institutionId, engineKey]);

  const toggleEngine = useCallback(async () => {
    const next = !engineEnabled;
    setEngineEnabled(next);
    try {
      if (engineConfigItemId) {
        await updateInstitutionEngineManagedItem(institutionId, engineKey, engineConfigItemId, { value_bool: next });
      } else {
        const res = await createInstitutionEngineManagedItem(institutionId, engineKey, {
          item_kind: 'engine_config',
          name: 'is_active',
          value_bool: next,
          status: 'active',
        });
        const newId = res?.data?.id ? String(res.data.id) : null;
        if (newId) setEngineConfigItemId(newId);
      }
    } catch {
      setEngineEnabled(!next);
    }
  }, [engineConfigItemId, engineEnabled, engineKey, institutionId]);

  /* ================= STAFF MANAGEMENT ================= */

  const [newStaff, setNewStaff] = useState({ name: "", role: "" });

  const addStaff = useCallback(async () => {
    if (!newStaff.name || !newStaff.role) return;

    const res = await postRequest(ROUTES.core.staff, {
      name: newStaff.name,
      role: newStaff.role,
      status: "Available",
    });

    const staff: Staff =
      res.success && res.data
        ? normalizeStaff(res.data)
        : {
            id: Date.now().toString(),
            name: newStaff.name,
            role: newStaff.role,
            status: "Available",
          };

    setStaffList((prev) => [...prev, staff]);
    setNewStaff({ name: "", role: "" });
  }, [newStaff]);

  const updateStaffStatus = useCallback(
    async (id: string, status: StaffStatus) => {
      await patchRequest(ROUTES.core.staffDetail(id), { status });
      setStaffList((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s))
      );
    },
    []
  );

  /* ================= SERVICE REQUESTS ================= */

  const [patientName, setPatientName] = useState("");
  const [location, setLocation] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [priority, setPriority] = useState<ServicePriority>("Normal");
  const [manualStaff, setManualStaff] = useState("");

  const createRequest = useCallback(async () => {
    if (!patientName || !location || !serviceType) return;

    const price = Number(defaultFee);
    const availableStaff = staffList.find((s) => s.status === "Available");
    const assigned =
      autoAssign && availableStaff ? availableStaff.id : manualStaff || undefined;

    const payload = {
      patient_name: patientName,
      location,
      service_type: serviceType,
      priority,
      assigned_staff: assigned,
      price,
    };

    const res = await postRequest(
      ROUTES.healthOps.homeLogisticsSessionStart,
      payload
    );

    const newRequest: ServiceRequest =
      res.success && res.data
        ? normalizeRequest(res.data)
        : {
            id: Date.now().toString(),
            patientName,
            location,
            type: serviceType,
            priority,
            assignedStaff: assigned,
            status: "Requested",
            price,
          };

    setRequests((prev) => [...prev, newRequest]);

    if (assigned && autoAssign && availableStaff) {
      updateStaffStatus(availableStaff.id, "Busy");
    }

    setPatientName("");
    setLocation("");
    setServiceType("");
    setManualStaff("");
  }, [
    patientName,
    location,
    serviceType,
    priority,
    manualStaff,
    defaultFee,
    staffList,
    autoAssign,
    updateStaffStatus,
  ]);

  const updateRequestStatus = useCallback(
    async (id: string, status: ServiceStatus) => {
      // Optimistic update first
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      // Terminal statuses use the end endpoint; intermediate statuses have no backend equivalent yet
      if (status === 'Completed' || status === 'Cancelled') {
        await postRequest(
          ROUTES.healthOps.homeLogisticsSessionEnd(id),
          { status: status.toLowerCase() },
        ).catch(() => undefined);
      }
    },
    []
  );

  /* ================= ANALYTICS ================= */
  const totalServices = requests.length;
  const activeServices = requests.filter(
    (r) => r.status !== "Completed" && r.status !== "Cancelled"
  ).length;
  const completedServices = requests.filter(
    (r) => r.status === "Completed"
  ).length;
  const revenue = requests.reduce((sum, r) => sum + r.price, 0);

  /* ================= UI ================= */

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.md,
          }}
        >
          <Text style={{ color: palette.text, marginBottom: spacing.md }}>
            {error}
          </Text>
          <KISButton title="Retry" onPress={() => fetchData()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
    <ScrollView
      style={{ padding: spacing.md }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchData(true)}
        />
      }
    >

      {/* CONFIGURATION */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Home Logistics Configuration
        </Text>
        <KISButton
          title={engineEnabled ? "Disable Engine" : "Enable Engine"}
          onPress={() => { toggleEngine().catch(() => undefined); }}
          variant="outline"
        />
        <TextInput
          placeholder="Default Fee (USD)"
          value={defaultFee}
          keyboardType="numeric"
          onChangeText={setDefaultFee}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Max Active Requests"
          value={maxActive}
          keyboardType="numeric"
          onChangeText={setMaxActive}
          style={input(palette, spacing)}
        />
        <KISButton
          title={
            autoAssign
              ? "Disable Auto-Assign Staff"
              : "Enable Auto-Assign Staff"
          }
          onPress={() => setAutoAssign(!autoAssign)}
          variant="outline"
        />
      </View>

      {/* STAFF MANAGEMENT */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Staff Management
        </Text>

        {staffList.length === 0 && (
          <Text style={{ color: palette.subtext }}>No staff loaded.</Text>
        )}

        {staffList.map((staff) => (
          <View key={staff.id} style={itemCard(palette, spacing)}>
            <Text style={{ color: palette.text }}>
              {staff.name} ({staff.role})
            </Text>
            <Text style={{ color: palette.subtext }}>
              Status: {staff.status}
            </Text>
            {(["Available", "Busy", "Offline"] as StaffStatus[]).map((s) => (
              <KISButton
                key={s}
                title={s}
                onPress={() => updateStaffStatus(staff.id, s)}
                variant="outline"
              />
            ))}
          </View>
        ))}

        <Text style={{ ...typography.h3, color: palette.text }}>Add Staff</Text>
        <TextInput
          placeholder="Name"
          value={newStaff.name}
          onChangeText={(text) => setNewStaff((prev) => ({ ...prev, name: text }))}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Role"
          value={newStaff.role}
          onChangeText={(text) => setNewStaff((prev) => ({ ...prev, role: text }))}
          style={input(palette, spacing)}
        />
        <KISButton title="Add Staff" onPress={addStaff} />
      </View>

      {/* CREATE SERVICE REQUEST */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Create Service Request
        </Text>
        <TextInput
          placeholder="Patient Name"
          value={patientName}
          onChangeText={setPatientName}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Location"
          value={location}
          onChangeText={setLocation}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Service Type (Medication Delivery / Lab Pickup / Home Visit)"
          value={serviceType}
          onChangeText={setServiceType}
          style={input(palette, spacing)}
        />

        {!autoAssign && (
          <TextInput
            placeholder="Assign Staff"
            value={manualStaff}
            onChangeText={setManualStaff}
            style={input(palette, spacing)}
          />
        )}

        {(["Normal", "Urgent", "Critical"] as ServicePriority[]).map((p) => (
          <KISButton
            key={p}
            title={p}
            onPress={() => setPriority(p)}
            variant={priority === p ? "primary" : "outline"}
          />
        ))}

        <KISButton title="Create Request" onPress={createRequest} />
      </View>

      {/* ACTIVE SERVICE REQUESTS */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Service Requests
        </Text>

        {requests.length === 0 && (
          <Text style={{ color: palette.subtext }}>No service requests.</Text>
        )}

        {requests.map((r) => (
          <View key={r.id} style={itemCard(palette, spacing)}>
            <Text style={{ color: palette.text }}>
              {r.patientName} ({r.type})
            </Text>
            <Text style={{ color: palette.subtext }}>
              Priority: {r.priority} - Status: {r.status} - Assigned:{" "}
              {r.assignedStaff || "Unassigned"} - Fee: {r.price} USD
            </Text>
            {(
              [
                "Requested",
                "Assigned",
                "En Route",
                "Completed",
                "Cancelled",
              ] as ServiceStatus[]
            ).map((s) => (
              <KISButton
                key={s}
                title={s}
                onPress={() => updateRequestStatus(r.id, s)}
                variant="outline"
              />
            ))}
          </View>
        ))}
      </View>

      {/* ANALYTICS */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Home Logistics Analytics
        </Text>
        <Text style={{ color: palette.text }}>
          Total Requests: {totalServices}
        </Text>
        <Text style={{ color: palette.text }}>
          Active Requests: {activeServices}
        </Text>
        <Text style={{ color: palette.text }}>
          Completed Requests: {completedServices}
        </Text>
        <Text style={{ color: palette.text }}>
          Revenue Generated: {revenue} USD
        </Text>
      </View>

    </ScrollView>
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */
const card = (palette: any, spacing: any) => ({
  backgroundColor: palette.surface,
  padding: spacing.md,
  borderRadius: 16,
  marginBottom: spacing.lg,
});

const input = (palette: any, spacing: any) => ({
  borderWidth: 1,
  borderColor: palette.divider,
  padding: spacing.sm,
  borderRadius: 12,
  marginVertical: spacing.xs,
  color: palette.text,
});

const itemCard = (palette: any, spacing: any) => ({
  backgroundColor: palette.bg, marginTop: 25,
  padding: spacing.sm,
  borderRadius: 12,
  marginVertical: spacing.xs,
});
