import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useColorScheme } from "react-native";
import { HEALTH_THEME_SPACING } from "@/theme/health/spacing";
import { HEALTH_THEME_TYPOGRAPHY } from "@/theme/health/typography";
import { getHealthThemeColors } from "@/theme/health/colors";
import KISButton from "@/constants/KISButton";

/* ================= TYPES ================= */

type VisitStatus = "Draft" | "Finalized" | "Locked";

type VisitRecord = {
  id: string;
  date: number;
  vitals: string;
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  diagnoses: string;
  medications: string;
  allergies: string;
  status: VisitStatus;
};

type Patient = {
  id: string;
  name: string;
  age: string;
  gender: string;
  history: string;
  surgeries: string;
  visits: VisitRecord[];
};

/* ================= COMPONENT ================= */

export default function EHRManager() {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === "light" ? "light" : "dark");
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  /* ================= CONFIG ================= */

  const [enabled, setEnabled] = useState(true);
  const [requireSignature, setRequireSignature] = useState(true);
  const [versionTracking, setVersionTracking] = useState(true);

  /* ================= PATIENTS ================= */

  const [patients, setPatients] = useState<Patient[]>([]);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newGender, setNewGender] = useState("");

  const createPatient = () => {
    if (!newName) return;

    const newPatient: Patient = {
      id: Date.now().toString(),
      name: newName,
      age: newAge,
      gender: newGender,
      history: "",
      surgeries: "",
      visits: [],
    };

    setPatients((prev) => [...prev, newPatient]);
    setNewName("");
    setNewAge("");
    setNewGender("");
  };

  const activePatient = patients.find((p) => p.id === activePatientId);

  /* ================= VISITS ================= */

  const addVisit = () => {
    if (!activePatient) return;

    const newVisit: VisitRecord = {
      id: Date.now().toString(),
      date: Date.now(),
      vitals: "",
      soap: { subjective: "", objective: "", assessment: "", plan: "" },
      diagnoses: "",
      medications: "",
      allergies: "",
      status: "Draft",
    };

    setPatients((prev) =>
      prev.map((p) =>
        p.id === activePatient.id
          ? { ...p, visits: [...p.visits, newVisit] }
          : p
      )
    );
  };

  const updateVisit = (
    visitId: string,
    field: keyof VisitRecord,
    value: any
  ) => {
    if (!activePatient) return;

    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== activePatient.id) return p;

        return {
          ...p,
          visits: p.visits.map((v) =>
            v.id === visitId ? { ...v, [field]: value } : v
          ),
        };
      })
    );
  };

  /* ================= ANALYTICS ================= */

  const totalPatients = patients.length;
  const totalVisits = patients.reduce((sum, p) => sum + p.visits.length, 0);
  const finalizedRecords = patients.reduce(
    (sum, p) =>
      sum + p.visits.filter((v) => v.status === "Finalized").length,
    0
  );

  const draftRecords = totalVisits - finalizedRecords;

  /* ================= UI ================= */

  return (
    <ScrollView style={{ padding: spacing.md }}>

      {/* ===== CONFIG ===== */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          EHR Configuration
        </Text>

        <KISButton
          title={enabled ? "Disable EHR" : "Enable EHR"}
          onPress={() => setEnabled(!enabled)}
          variant="outline"
        />

        <KISButton
          title={
            requireSignature
              ? "Disable Signature Requirement"
              : "Require Signature"
          }
          onPress={() => setRequireSignature(!requireSignature)}
          variant="outline"
        />

        <KISButton
          title={
            versionTracking
              ? "Disable Version Tracking"
              : "Enable Version Tracking"
          }
          onPress={() => setVersionTracking(!versionTracking)}
          variant="outline"
        />
      </View>

      {/* ===== CREATE PATIENT ===== */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Create Patient
        </Text>

        <TextInput
          placeholder="Full Name"
          value={newName}
          onChangeText={setNewName}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Age"
          value={newAge}
          onChangeText={setNewAge}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Gender"
          value={newGender}
          onChangeText={setNewGender}
          style={input(palette, spacing)}
        />

        <KISButton title="Create Patient" onPress={createPatient} />
      </View>

      {/* ===== PATIENT LIST ===== */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Patients
        </Text>

        {patients.map((patient) => (
          <TouchableOpacity
            key={patient.id}
            onPress={() => setActivePatientId(patient.id)}
            style={[
              itemCard(palette, spacing),
              activePatientId === patient.id && {
                borderWidth: 2,
                borderColor: palette.primary,
              },
            ]}
          >
            <Text style={{ color: palette.text }}>
              {patient.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ===== ACTIVE PATIENT RECORD ===== */}
      {activePatient && (
        <View style={card(palette, spacing)}>
          <Text style={{ ...typography.h2, color: palette.text }}>
            {activePatient.name} - Record
          </Text>

          <TextInput
            placeholder="Medical History"
            value={activePatient.history}
            onChangeText={(text) =>
              setPatients((prev) =>
                prev.map((p) =>
                  p.id === activePatient.id
                    ? { ...p, history: text }
                    : p
                )
              )
            }
            style={input(palette, spacing)}
          />

          <TextInput
            placeholder="Surgical History"
            value={activePatient.surgeries}
            onChangeText={(text) =>
              setPatients((prev) =>
                prev.map((p) =>
                  p.id === activePatient.id
                    ? { ...p, surgeries: text }
                    : p
                )
              )
            }
            style={input(palette, spacing)}
          />

          <KISButton title="Add Visit" onPress={addVisit} />

          {activePatient.visits.map((visit) => (
            <View key={visit.id} style={itemCard(palette, spacing)}>
              <Text style={{ color: palette.text }}>
                Visit Date: {new Date(visit.date).toLocaleString()}
              </Text>

              <TextInput
                placeholder="Vitals"
                value={visit.vitals}
                onChangeText={(text) =>
                  updateVisit(visit.id, "vitals", text)
                }
                style={input(palette, spacing)}
              />

              <TextInput
                placeholder="SOAP - Subjective"
                value={visit.soap.subjective}
                onChangeText={(text) =>
                  updateVisit(visit.id, "soap", {
                    ...visit.soap,
                    subjective: text,
                  })
                }
                style={input(palette, spacing)}
              />

              <TextInput
                placeholder="Diagnoses"
                value={visit.diagnoses}
                onChangeText={(text) =>
                  updateVisit(visit.id, "diagnoses", text)
                }
                style={input(palette, spacing)}
              />

              <TextInput
                placeholder="Medications"
                value={visit.medications}
                onChangeText={(text) =>
                  updateVisit(visit.id, "medications", text)
                }
                style={input(palette, spacing)}
              />

              <Text style={{ color: palette.subtext }}>
                Status: {visit.status}
              </Text>

              {["Draft", "Finalized", "Locked"].map((s) => (
                <KISButton
                  key={s}
                  title={s}
                  onPress={() =>
                    updateVisit(visit.id, "status", s)
                  }
                  variant="outline"
                />
              ))}
            </View>
          ))}
        </View>
      )}

      {/* ===== ANALYTICS ===== */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          EHR Analytics
        </Text>

        <Text style={{ color: palette.text }}>
          Total Patients: {totalPatients}
        </Text>
        <Text style={{ color: palette.text }}>
          Total Visits: {totalVisits}
        </Text>
        <Text style={{ color: palette.text }}>
          Finalized Records: {finalizedRecords}
        </Text>
        <Text style={{ color: palette.text }}>
          Draft Records: {draftRecords}
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