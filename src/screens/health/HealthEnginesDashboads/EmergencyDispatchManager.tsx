import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useColorScheme } from "react-native";
import { HEALTH_THEME_SPACING } from "@/theme/health/spacing";
import { HEALTH_THEME_TYPOGRAPHY } from "@/theme/health/typography";
import { getHealthThemeColors } from "@/theme/health/colors";
import KISButton from "@/constants/KISButton";
import ROUTES from "@/network";
import { getRequest } from "@/network/get";
import { postRequest } from "@/network/post";
import { patchRequest } from "@/network/patch";

/* ================= TYPES ================= */

type AmbulanceStatus =
  | "Available"
  | "En Route"
  | "At Scene"
  | "Transporting"
  | "Offline";

type EmergencyPriority =
  | "Low"
  | "Medium"
  | "High"
  | "Critical";

type EmergencyStatus =
  | "Requested"
  | "Dispatched"
  | "En Route"
  | "At Scene"
  | "Transporting"
  | "Completed"
  | "Cancelled";

type Ambulance = {
  id: string;
  driver: string;
  location: string;
  status: AmbulanceStatus;
};

type EmergencyRequest = {
  id: string;
  patientName: string;
  location: string;
  type: string;
  priority: EmergencyPriority;
  distanceKm: number;
  assignedAmbulance?: string;
  status: EmergencyStatus;
  price: number;
};

/* ================= HELPERS ================= */

const normalizeAmbulance = (raw: any): Ambulance => ({
  id: String(raw.id ?? ""),
  driver: raw.driver ?? raw.driver_name ?? raw.name ?? "Unknown",
  location: raw.location ?? raw.current_location ?? "",
  status: (raw.status ?? "Available") as AmbulanceStatus,
});

const normalizeRequest = (raw: any): EmergencyRequest => ({
  id: String(raw.id ?? ""),
  patientName:
    raw.patient_name ??
    raw.patientName ??
    raw.patient?.name ??
    raw.patient?.full_name ??
    "Unknown",
  location: raw.location ?? raw.pickup_location ?? "",
  type: raw.type ?? raw.emergency_type ?? raw.incident_type ?? "",
  priority: (raw.priority ?? "Low") as EmergencyPriority,
  distanceKm: raw.distance_km ?? raw.distanceKm ?? 0,
  assignedAmbulance: raw.assigned_ambulance ?? raw.assignedAmbulance,
  status: (raw.status ?? "Requested") as EmergencyStatus,
  price: raw.price ?? raw.total_fee ?? 0,
});

/* ================= COMPONENT ================= */

export default function EmergencyDispatchManager() {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === "light" ? "light" : "dark");
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  /* ================= CONFIG ================= */

  const [engineEnabled, setEngineEnabled] = useState(true);
  const [baseFee, setBaseFee] = useState("200");
  const [perKmFee, setPerKmFee] = useState("20");
  const [autoAssign, setAutoAssign] = useState(true);

  /* ================= REMOTE DATA ================= */

  const [fleet, setFleet] = useState<Ambulance[]>([]);
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);

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
      // Load emergency sessions (active requests) and staff (fleet)
      const [sessionsRes, staffRes] = await Promise.all([
        getRequest(ROUTES.healthOps.emergencySessionStart.replace("/start/", "/"), {}),
        getRequest(ROUTES.core.staff, {}),
      ]);

      if (sessionsRes.success) {
        const data = sessionsRes.data;
        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
          ? data.results
          : [];
        setRequests(list.map(normalizeRequest));
      }

      if (staffRes.success) {
        const data = staffRes.data;
        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
          ? data.results
          : [];
        setFleet(list.map(normalizeAmbulance));
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load emergency data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ================= FLEET ACTIONS ================= */

  const [newDriver, setNewDriver] = useState("");
  const [newLocation, setNewLocation] = useState("");

  const addAmbulance = useCallback(async () => {
    if (!newDriver) return;

    const res = await postRequest(ROUTES.core.staff, {
      name: newDriver,
      location: newLocation,
      status: "Available",
      role: "EMT",
    });

    const newAmbulance: Ambulance =
      res.success && res.data
        ? normalizeAmbulance(res.data)
        : {
            id: Date.now().toString(),
            driver: newDriver,
            location: newLocation,
            status: "Available",
          };

    setFleet((prev) => [...prev, newAmbulance]);
    setNewDriver("");
    setNewLocation("");
  }, [newDriver, newLocation]);

  const updateAmbulanceStatus = useCallback(
    async (id: string, status: AmbulanceStatus) => {
      await patchRequest(ROUTES.core.staffDetail(id), { status });
      setFleet((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    },
    []
  );

  /* ================= EMERGENCY REQUEST ================= */

  const [patientName, setPatientName] = useState("");
  const [location, setLocation] = useState("");
  const [emergencyType, setEmergencyType] = useState("");
  const [priority, setPriority] = useState<EmergencyPriority>("Low");
  const [distanceKm, setDistanceKm] = useState("");

  const createRequest = useCallback(async () => {
    if (!patientName || !location || !distanceKm) return;

    const km = Number(distanceKm);
    const price = Number(baseFee) + km * Number(perKmFee);

    const availableAmbulance = fleet.find((a) => a.status === "Available");

    const payload = {
      patient_name: patientName,
      location,
      emergency_type: emergencyType,
      priority,
      distance_km: km,
      price,
      assigned_ambulance:
        autoAssign && availableAmbulance ? availableAmbulance.id : undefined,
    };

    const res = await postRequest(ROUTES.healthOps.emergencySessionStart, payload);

    const newRequest: EmergencyRequest =
      res.success && res.data
        ? normalizeRequest(res.data)
        : {
            id: Date.now().toString(),
            patientName,
            location,
            type: emergencyType,
            priority,
            distanceKm: km,
            assignedAmbulance:
              autoAssign && availableAmbulance
                ? availableAmbulance.id
                : undefined,
            status: "Requested",
            price,
          };

    setRequests((prev) => [...prev, newRequest]);

    if (autoAssign && availableAmbulance) {
      updateAmbulanceStatus(availableAmbulance.id, "En Route");
    }

    setPatientName("");
    setLocation("");
    setEmergencyType("");
    setDistanceKm("");
  }, [
    patientName,
    location,
    emergencyType,
    priority,
    distanceKm,
    baseFee,
    perKmFee,
    fleet,
    autoAssign,
    updateAmbulanceStatus,
  ]);

  const updateRequestStatus = useCallback(
    async (id: string, status: EmergencyStatus) => {
      const res = await patchRequest(ROUTES.healthOps.emergencySession(id), {
        status,
      });
      if (res.success || true) {
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status } : r))
        );
      }
    },
    []
  );

  /* ================= ANALYTICS ================= */

  const totalEmergencies = requests.length;
  const criticalCases = requests.filter((r) => r.priority === "Critical").length;
  const completedResponses = requests.filter((r) => r.status === "Completed").length;
  const revenue = requests.reduce((sum, r) => sum + r.price, 0);
  const activeAmbulances = fleet.filter((a) => a.status !== "Offline").length;

  /* ================= UI ================= */

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (error) {
    return (
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
    );
  }

  return (
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
          Emergency Dispatch Configuration
        </Text>

        <KISButton
          title={engineEnabled ? "Disable Engine" : "Enable Engine"}
          onPress={() => setEngineEnabled(!engineEnabled)}
          variant="outline"
        />

        <TextInput
          placeholder="Base Dispatch Fee (USD)"
          value={baseFee}
          keyboardType="numeric"
          onChangeText={setBaseFee}
          style={input(palette, spacing)}
        />

        <TextInput
          placeholder="Per KM Fee (USD)"
          value={perKmFee}
          keyboardType="numeric"
          onChangeText={setPerKmFee}
          style={input(palette, spacing)}
        />

        <KISButton
          title={autoAssign ? "Disable Auto-Assign" : "Enable Auto-Assign"}
          onPress={() => setAutoAssign(!autoAssign)}
          variant="outline"
        />
      </View>

      {/* FLEET MANAGEMENT */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Fleet Management
        </Text>

        {fleet.length === 0 && (
          <Text style={{ color: palette.subtext }}>No fleet members loaded.</Text>
        )}

        {fleet.map((ambulance) => (
          <View key={ambulance.id} style={itemCard(palette, spacing)}>
            <Text style={{ color: palette.text }}>
              Driver: {ambulance.driver}
            </Text>
            <Text style={{ color: palette.subtext }}>
              Location: {ambulance.location}
            </Text>
            <Text style={{ color: palette.subtext }}>
              Status: {ambulance.status}
            </Text>

            {(
              [
                "Available",
                "En Route",
                "At Scene",
                "Transporting",
                "Offline",
              ] as AmbulanceStatus[]
            ).map((status) => (
              <KISButton
                key={status}
                title={status}
                onPress={() => updateAmbulanceStatus(ambulance.id, status)}
                variant="outline"
              />
            ))}
          </View>
        ))}

        <Text style={{ ...typography.h3, color: palette.text }}>
          Add Ambulance
        </Text>

        <TextInput
          placeholder="Driver Name"
          value={newDriver}
          onChangeText={setNewDriver}
          style={input(palette, spacing)}
        />

        <TextInput
          placeholder="Location"
          value={newLocation}
          onChangeText={setNewLocation}
          style={input(palette, spacing)}
        />

        <KISButton title="Add Ambulance" onPress={addAmbulance} />
      </View>

      {/* CREATE EMERGENCY */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Create Emergency Request
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
          placeholder="Emergency Type"
          value={emergencyType}
          onChangeText={setEmergencyType}
          style={input(palette, spacing)}
        />

        <TextInput
          placeholder="Distance (KM)"
          value={distanceKm}
          keyboardType="numeric"
          onChangeText={setDistanceKm}
          style={input(palette, spacing)}
        />

        {(["Low", "Medium", "High", "Critical"] as EmergencyPriority[]).map(
          (p) => (
            <KISButton
              key={p}
              title={p}
              onPress={() => setPriority(p)}
              variant={priority === p ? "primary" : "outline"}
            />
          )
        )}

        <KISButton title="Create Emergency" onPress={createRequest} />
      </View>

      {/* ACTIVE REQUESTS */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Active Emergency Requests
        </Text>

        {requests.length === 0 && (
          <Text style={{ color: palette.subtext }}>No emergency requests.</Text>
        )}

        {requests.map((req) => (
          <View key={req.id} style={itemCard(palette, spacing)}>
            <Text style={{ color: palette.text }}>{req.patientName}</Text>
            <Text style={{ color: palette.subtext }}>
              {req.priority} - {req.status}
            </Text>
            <Text style={{ color: palette.subtext }}>
              Price: {req.price} USD
            </Text>

            {(
              [
                "Dispatched",
                "En Route",
                "At Scene",
                "Transporting",
                "Completed",
                "Cancelled",
              ] as EmergencyStatus[]
            ).map((status) => (
              <KISButton
                key={status}
                title={status}
                onPress={() => updateRequestStatus(req.id, status)}
                variant="outline"
              />
            ))}
          </View>
        ))}
      </View>

      {/* ANALYTICS */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Dispatch Analytics
        </Text>

        <Text style={{ color: palette.text }}>
          Total Emergencies: {totalEmergencies}
        </Text>
        <Text style={{ color: palette.text }}>
          Critical Cases: {criticalCases}
        </Text>
        <Text style={{ color: palette.text }}>
          Completed Responses: {completedResponses}
        </Text>
        <Text style={{ color: palette.text }}>
          Active Ambulances: {activeAmbulances}
        </Text>
        <Text style={{ color: palette.text }}>
          Revenue Generated: {revenue} USD
        </Text>
      </View>

    </ScrollView>
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
  backgroundColor: palette.background,
  padding: spacing.sm,
  borderRadius: 12,
  marginVertical: spacing.xs,
});
