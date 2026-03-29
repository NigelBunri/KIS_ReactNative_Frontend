import React, { useState } from "react";
import { View, Text, ScrollView, TextInput } from "react-native";
import { useColorScheme } from "react-native";
import { HEALTH_THEME_SPACING } from "@/theme/health/spacing";
import { HEALTH_THEME_TYPOGRAPHY } from "@/theme/health/typography";
import { getHealthThemeColors } from "@/theme/health/colors";
import KISButton from "@/constants/KISButton";

/* ================= TYPES ================= */

type StaffStatus = "Available" | "Busy" | "Offline";
type ServicePriority = "Normal" | "Urgent" | "Critical";
type ServiceStatus = "Requested" | "Assigned" | "En Route" | "Completed" | "Cancelled";

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

/* ================= COMPONENT ================= */

export default function HomeLogisticsManager() {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === "light" ? "light" : "dark");
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  /* ================= CONFIG ================= */
  const [engineEnabled, setEngineEnabled] = useState(true);
  const [defaultFee, setDefaultFee] = useState("200");
  const [autoAssign, setAutoAssign] = useState(true);
  const [maxActive, setMaxActive] = useState("10");

  /* ================= STAFF MANAGEMENT ================= */
  const [staffList, setStaffList] = useState<Staff[]>([
    { id: "1", name: "Alice Nurse", role: "Nurse", status: "Available" },
    { id: "2", name: "Bob Driver", role: "Driver", status: "Available" },
  ]);

  const [newStaff, setNewStaff] = useState({ name: "", role: "" });

  const addStaff = () => {
    if (!newStaff.name || !newStaff.role) return;
    const staff: Staff = {
      id: Date.now().toString(),
      name: newStaff.name,
      role: newStaff.role,
      status: "Available",
    };
    setStaffList(prev => [...prev, staff]);
    setNewStaff({ name: "", role: "" });
  };

  const updateStaffStatus = (id: string, status: StaffStatus) => {
    setStaffList(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  /* ================= SERVICE REQUESTS ================= */
  const [patientName, setPatientName] = useState("");
  const [location, setLocation] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [priority, setPriority] = useState<ServicePriority>("Normal");
  const [manualStaff, setManualStaff] = useState("");

  const [requests, setRequests] = useState<ServiceRequest[]>([]);

  const createRequest = () => {
    if (!patientName || !location || !serviceType) return;

    const price = Number(defaultFee);

    const availableStaff = staffList.find(s => s.status === "Available");

    const assigned = autoAssign && availableStaff ? availableStaff.id : manualStaff || undefined;

    if (assigned && autoAssign && availableStaff) {
      updateStaffStatus(availableStaff.id, "Busy");
    }

    const newRequest: ServiceRequest = {
      id: Date.now().toString(),
      patientName,
      location,
      type: serviceType,
      priority,
      assignedStaff: assigned,
      status: "Requested",
      price,
    };

    setRequests(prev => [...prev, newRequest]);
    setPatientName("");
    setLocation("");
    setServiceType("");
    setManualStaff("");
  };

  const updateRequestStatus = (id: string, status: ServiceStatus) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  /* ================= ANALYTICS ================= */
  const totalServices = requests.length;
  const activeServices = requests.filter(r => r.status !== "Completed" && r.status !== "Cancelled").length;
  const completedServices = requests.filter(r => r.status === "Completed").length;
  const revenue = requests.reduce((sum, r) => sum + r.price, 0);

  /* ================= UI ================= */

  return (
    <ScrollView style={{ padding: spacing.md }}>

      {/* CONFIGURATION */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Home Logistics Configuration</Text>
        <KISButton
          title={engineEnabled ? "Disable Engine" : "Enable Engine"}
          onPress={() => setEngineEnabled(!engineEnabled)}
          variant="outline"
        />
        <TextInput placeholder="Default Fee (KISC)" value={defaultFee} keyboardType="numeric" onChangeText={setDefaultFee} style={input(palette, spacing)} />
        <TextInput placeholder="Max Active Requests" value={maxActive} keyboardType="numeric" onChangeText={setMaxActive} style={input(palette, spacing)} />
        <KISButton title={autoAssign ? "Disable Auto-Assign Staff" : "Enable Auto-Assign Staff"} onPress={() => setAutoAssign(!autoAssign)} variant="outline" />
      </View>

      {/* STAFF MANAGEMENT */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Staff Management</Text>
        {staffList.map(staff => (
          <View key={staff.id} style={itemCard(palette, spacing)}>
            <Text style={{ color: palette.text }}>{staff.name} ({staff.role})</Text>
            <Text style={{ color: palette.subtext }}>Status: {staff.status}</Text>
            {["Available", "Busy", "Offline"].map(s => (
              <KISButton key={s} title={s} onPress={() => updateStaffStatus(staff.id, s as StaffStatus)} variant="outline" />
            ))}
          </View>
        ))}

        <Text style={{ ...typography.h3, color: palette.text }}>Add Staff</Text>
        <TextInput placeholder="Name" value={newStaff.name} onChangeText={text => setNewStaff(prev => ({ ...prev, name: text }))} style={input(palette, spacing)} />
        <TextInput placeholder="Role" value={newStaff.role} onChangeText={text => setNewStaff(prev => ({ ...prev, role: text }))} style={input(palette, spacing)} />
        <KISButton title="Add Staff" onPress={addStaff} />
      </View>

      {/* CREATE SERVICE REQUEST */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Create Service Request</Text>
        <TextInput placeholder="Patient Name" value={patientName} onChangeText={setPatientName} style={input(palette, spacing)} />
        <TextInput placeholder="Location" value={location} onChangeText={setLocation} style={input(palette, spacing)} />
        <TextInput placeholder="Service Type (Medication Delivery / Lab Pickup / Home Visit)" value={serviceType} onChangeText={setServiceType} style={input(palette, spacing)} />

        {!autoAssign && <TextInput placeholder="Assign Staff" value={manualStaff} onChangeText={setManualStaff} style={input(palette, spacing)} />}

        {["Normal", "Urgent", "Critical"].map(p => (
          <KISButton key={p} title={p} onPress={() => setPriority(p as ServicePriority)} variant={priority === p ? "primary" : "outline"} />
        ))}

        <KISButton title="Create Request" onPress={createRequest} />
      </View>

      {/* ACTIVE SERVICE REQUESTS */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Service Requests</Text>
        {requests.map(r => (
          <View key={r.id} style={itemCard(palette, spacing)}>
            <Text style={{ color: palette.text }}>{r.patientName} ({r.type})</Text>
            <Text style={{ color: palette.subtext }}>Priority: {r.priority} • Status: {r.status} • Assigned: {r.assignedStaff || "Unassigned"} • Fee: {r.price} KISC</Text>
            {["Requested", "Assigned", "En Route", "Completed", "Cancelled"].map(s => (
              <KISButton key={s} title={s} onPress={() => updateRequestStatus(r.id, s as ServiceStatus)} variant="outline" />
            ))}
          </View>
        ))}
      </View>

      {/* ANALYTICS */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Home Logistics Analytics</Text>
        <Text style={{ color: palette.text }}>Total Requests: {totalServices}</Text>
        <Text style={{ color: palette.text }}>Active Requests: {activeServices}</Text>
        <Text style={{ color: palette.text }}>Completed Requests: {completedServices}</Text>
        <Text style={{ color: palette.text }}>Revenue Generated: {revenue} KISC</Text>
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
