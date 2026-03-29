import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
} from "react-native";
import { useColorScheme } from "react-native";
import { HEALTH_THEME_SPACING } from "@/theme/health/spacing";
import { HEALTH_THEME_TYPOGRAPHY } from "@/theme/health/typography";
import { getHealthThemeColors } from "@/theme/health/colors";
import KISButton from "@/constants/KISButton";

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

  /* ================= FLEET ================= */

  const [fleet, setFleet] = useState<Ambulance[]>([
    {
      id: "1",
      driver: "John EMT",
      location: "Station A",
      status: "Available",
    },
  ]);

  const [newDriver, setNewDriver] = useState("");
  const [newLocation, setNewLocation] = useState("");

  const addAmbulance = () => {
    if (!newDriver) return;

    const newAmbulance: Ambulance = {
      id: Date.now().toString(),
      driver: newDriver,
      location: newLocation,
      status: "Available",
    };

    setFleet((prev) => [...prev, newAmbulance]);
    setNewDriver("");
    setNewLocation("");
  };

  const updateAmbulanceStatus = (
    id: string,
    status: AmbulanceStatus
  ) => {
    setFleet((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status } : a
      )
    );
  };

  /* ================= EMERGENCY REQUEST ================= */

  const [patientName, setPatientName] = useState("");
  const [location, setLocation] = useState("");
  const [emergencyType, setEmergencyType] = useState("");
  const [priority, setPriority] =
    useState<EmergencyPriority>("Low");
  const [distanceKm, setDistanceKm] = useState("");

  const [requests, setRequests] = useState<EmergencyRequest[]>([]);

  const createRequest = () => {
    if (!patientName || !location || !distanceKm) return;

    const km = Number(distanceKm);
    const price =
      Number(baseFee) + km * Number(perKmFee);

    const availableAmbulance = fleet.find(
      (a) => a.status === "Available"
    );

    const newRequest: EmergencyRequest = {
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
      updateAmbulanceStatus(
        availableAmbulance.id,
        "En Route"
      );
    }

    setPatientName("");
    setLocation("");
    setEmergencyType("");
    setDistanceKm("");
  };

  const updateRequestStatus = (
    id: string,
    status: EmergencyStatus
  ) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status } : r
      )
    );
  };

  /* ================= ANALYTICS ================= */

  const totalEmergencies = requests.length;
  const criticalCases = requests.filter(
    (r) => r.priority === "Critical"
  ).length;
  const completedResponses = requests.filter(
    (r) => r.status === "Completed"
  ).length;
  const revenue = requests.reduce(
    (sum, r) => sum + r.price,
    0
  );

  const activeAmbulances = fleet.filter(
    (a) => a.status !== "Offline"
  ).length;

  /* ================= UI ================= */

  return (
    <ScrollView style={{ padding: spacing.md }}>

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
          placeholder="Base Dispatch Fee (KISC)"
          value={baseFee}
          keyboardType="numeric"
          onChangeText={setBaseFee}
          style={input(palette, spacing)}
        />

        <TextInput
          placeholder="Per KM Fee (KISC)"
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

            {[
              "Available",
              "En Route",
              "At Scene",
              "Transporting",
              "Offline",
            ].map((status) => (
              <KISButton
                key={status}
                title={status}
                onPress={() =>
                  updateAmbulanceStatus(
                    ambulance.id,
                    status as AmbulanceStatus
                  )
                }
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

        {["Low", "Medium", "High", "Critical"].map((p) => (
          <KISButton
            key={p}
            title={p}
            onPress={() => setPriority(p as EmergencyPriority)}
            variant={priority === p ? "primary" : "outline"}
          />
        ))}

        <KISButton
          title="Create Emergency"
          onPress={createRequest}
        />
      </View>

      {/* ACTIVE REQUESTS */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Active Emergency Requests
        </Text>

        {requests.map((req) => (
          <View key={req.id} style={itemCard(palette, spacing)}>
            <Text style={{ color: palette.text }}>
              {req.patientName}
            </Text>
            <Text style={{ color: palette.subtext }}>
              {req.priority} • {req.status}
            </Text>
            <Text style={{ color: palette.subtext }}>
              Price: {req.price} KISC
            </Text>

            {[
              "Dispatched",
              "En Route",
              "At Scene",
              "Transporting",
              "Completed",
              "Cancelled",
            ].map((status) => (
              <KISButton
                key={status}
                title={status}
                onPress={() =>
                  updateRequestStatus(
                    req.id,
                    status as EmergencyStatus
                  )
                }
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
          Revenue Generated: {revenue} KISC
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
