import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { HEALTH_THEME_SPACING } from "@/theme/health/spacing";
import { HEALTH_THEME_TYPOGRAPHY } from "@/theme/health/typography";
import { getHealthThemeColors } from "@/theme/health/colors";
import KISButton from "@/constants/KISButton";
import ROUTES from "@/network";
import { getRequest } from "@/network/get";
import { postRequest } from "@/network/post";
import { patchRequest } from "@/network/patch";

/* ================= TYPES ================= */

type VisitStatus = "Draft" | "Finalized" | "Locked";

type Encounter = {
  id: string;
  date: string;
  vitals: string;
  soap_subjective: string;
  soap_objective: string;
  soap_assessment: string;
  soap_plan: string;
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
};

/* ================= COMPONENT ================= */

type Props = { institutionId: string; engineKey: string };

export default function EHRManager({ institutionId }: Props) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === "light" ? "light" : "dark");
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  /* ================= CONFIG ================= */

  const [enabled, setEnabled] = useState(true);
  const [requireSignature, setRequireSignature] = useState(true);
  const [versionTracking, setVersionTracking] = useState(true);

  const saveConfig = useCallback(async (patch: Record<string, boolean>) => {
    if (!institutionId) return;
    await patchRequest(ROUTES.healthDashboard.institution(institutionId), patch).catch(() => undefined);
  }, [institutionId]);

  /* ================= PATIENTS ================= */

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newGender, setNewGender] = useState("");

  const fetchPatients = useCallback(async () => {
    setLoadingPatients(true);
    try {
      const res = await getRequest(ROUTES.patients.master, {
        errorMessage: "Unable to load patients.",
      });
      const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
      setPatients(Array.isArray(list) ? list : []);
    } catch {
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const createPatient = async () => {
    if (!newName) return;
    setSavingPatient(true);
    try {
      const res = await postRequest(ROUTES.patients.master, {
        name: newName,
        age: newAge,
        gender: newGender,
      });
      const created = res?.data ?? res;
      if (created?.id) {
        setPatients((prev) => [...prev, created]);
        setNewName("");
        setNewAge("");
        setNewGender("");
      } else {
        await fetchPatients();
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not create patient.");
    } finally {
      setSavingPatient(false);
    }
  };

  const activePatient = patients.find((p) => p.id === activePatientId);

  /* ================= ENCOUNTERS ================= */

  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loadingEncounters, setLoadingEncounters] = useState(false);
  const [addingVisit, setAddingVisit] = useState(false);

  const fetchEncounters = useCallback(async (patientId: string) => {
    setLoadingEncounters(true);
    try {
      const res = await getRequest(
        `${ROUTES.patients.encounters}?patient=${patientId}`,
        { errorMessage: "Unable to load encounters." }
      );
      const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
      setEncounters(Array.isArray(list) ? list : []);
    } catch {
      setEncounters([]);
    } finally {
      setLoadingEncounters(false);
    }
  }, []);

  useEffect(() => {
    if (activePatientId) {
      fetchEncounters(activePatientId);
    } else {
      setEncounters([]);
    }
  }, [activePatientId, fetchEncounters]);

  const addVisit = async () => {
    if (!activePatient) return;
    setAddingVisit(true);
    try {
      const res = await postRequest(ROUTES.patients.encounters, {
        patient: activePatient.id,
        status: "Draft",
      });
      const created = res?.data ?? res;
      if (created?.id) {
        setEncounters((prev) => [...prev, created]);
      } else {
        await fetchEncounters(activePatient.id);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not create encounter.");
    } finally {
      setAddingVisit(false);
    }
  };

  const updateEncounterField = async (
    encounterId: string,
    field: string,
    value: string
  ) => {
    setEncounters((prev) =>
      prev.map((e) => (e.id === encounterId ? { ...e, [field]: value } : e))
    );
    try {
      await patchRequest(
        `${ROUTES.patients.encounters}${encounterId}/`,
        { [field]: value }
      );
    } catch {
      // optimistic update; local state already reflects change
    }
  };

  const updateEncounterStatus = async (
    encounterId: string,
    status: VisitStatus
  ) => {
    setEncounters((prev) =>
      prev.map((e) => (e.id === encounterId ? { ...e, status } : e))
    );
    try {
      await patchRequest(
        `${ROUTES.patients.encounters}${encounterId}/`,
        { status }
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not update status.");
    }
  };

  /* ================= ANALYTICS ================= */

  const totalPatients = patients.length;
  const totalVisits = encounters.length;
  const finalizedRecords = encounters.filter((e) => e.status === "Finalized").length;
  const draftRecords = encounters.filter((e) => e.status === "Draft").length;

  /* ================= UI ================= */

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
    <ScrollView style={{ padding: spacing.md }}>

      {/* ===== CONFIG ===== */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          EHR Configuration
        </Text>

        <KISButton
          title={enabled ? "Disable EHR" : "Enable EHR"}
          onPress={() => { setEnabled((v) => { saveConfig({ ehr_enabled: !v }); return !v; }); }}
          variant="outline"
        />
        <KISButton
          title={requireSignature ? "Disable Signature Requirement" : "Require Signature"}
          onPress={() => { setRequireSignature((v) => { saveConfig({ require_signature: !v }); return !v; }); }}
          variant="outline"
        />
        <KISButton
          title={versionTracking ? "Disable Version Tracking" : "Enable Version Tracking"}
          onPress={() => { setVersionTracking((v) => { saveConfig({ version_tracking: !v }); return !v; }); }}
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
          placeholderTextColor={palette.subtext}
          value={newName}
          onChangeText={setNewName}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Age"
          placeholderTextColor={palette.subtext}
          value={newAge}
          onChangeText={setNewAge}
          keyboardType="numeric"
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Gender"
          placeholderTextColor={palette.subtext}
          value={newGender}
          onChangeText={setNewGender}
          style={input(palette, spacing)}
        />

        <KISButton
          title={savingPatient ? "Saving…" : "Create Patient"}
          onPress={createPatient}
        />
      </View>

      {/* ===== PATIENT LIST ===== */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Patients
        </Text>

        {loadingPatients ? (
          <ActivityIndicator color={palette.primary} />
        ) : patients.length === 0 ? (
          <Text style={{ color: palette.subtext }}>No patients found.</Text>
        ) : (
          patients.map((patient) => (
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
              <Text style={{ color: palette.text }}>{patient.name}</Text>
              {patient.age ? (
                <Text style={{ color: palette.subtext }}>
                  {patient.age} · {patient.gender}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* ===== ACTIVE PATIENT RECORD ===== */}
      {activePatient && (
        <View style={card(palette, spacing)}>
          <Text style={{ ...typography.h2, color: palette.text }}>
            {activePatient.name} — Record
          </Text>

          {loadingEncounters ? (
            <ActivityIndicator color={palette.primary} />
          ) : (
            <>
              <KISButton
                title={addingVisit ? "Adding…" : "Add Visit"}
                onPress={addVisit}
              />

              {encounters.map((enc) => (
                <View key={enc.id} style={itemCard(palette, spacing)}>
                  <Text style={{ color: palette.text }}>
                    Visit:{" "}
                    {enc.date
                      ? new Date(enc.date).toLocaleDateString()
                      : "New"}
                  </Text>

                  <TextInput
                    placeholder="Vitals"
                    value={enc.vitals ?? ""}
                    onChangeText={(text) =>
                      updateEncounterField(enc.id, "vitals", text)
                    }
                    style={input(palette, spacing)}
                  />

                  <TextInput
                    placeholder="SOAP — Subjective"
                    value={enc.soap_subjective ?? ""}
                    onChangeText={(text) =>
                      updateEncounterField(enc.id, "soap_subjective", text)
                    }
                    style={input(palette, spacing)}
                  />

                  <TextInput
                    placeholder="SOAP — Objective"
                    value={enc.soap_objective ?? ""}
                    onChangeText={(text) =>
                      updateEncounterField(enc.id, "soap_objective", text)
                    }
                    style={input(palette, spacing)}
                  />

                  <TextInput
                    placeholder="SOAP — Assessment"
                    value={enc.soap_assessment ?? ""}
                    onChangeText={(text) =>
                      updateEncounterField(enc.id, "soap_assessment", text)
                    }
                    style={input(palette, spacing)}
                  />

                  <TextInput
                    placeholder="SOAP — Plan"
                    value={enc.soap_plan ?? ""}
                    onChangeText={(text) =>
                      updateEncounterField(enc.id, "soap_plan", text)
                    }
                    style={input(palette, spacing)}
                  />

                  <TextInput
                    placeholder="Diagnoses"
                    value={enc.diagnoses ?? ""}
                    onChangeText={(text) =>
                      updateEncounterField(enc.id, "diagnoses", text)
                    }
                    style={input(palette, spacing)}
                  />

                  <TextInput
                    placeholder="Medications"
                    value={enc.medications ?? ""}
                    onChangeText={(text) =>
                      updateEncounterField(enc.id, "medications", text)
                    }
                    style={input(palette, spacing)}
                  />

                  <TextInput
                    placeholder="Allergies"
                    value={enc.allergies ?? ""}
                    onChangeText={(text) =>
                      updateEncounterField(enc.id, "allergies", text)
                    }
                    style={input(palette, spacing)}
                  />

                  <Text style={{ color: palette.subtext, marginTop: 6 }}>
                    Status: {enc.status}
                  </Text>

                  {(["Draft", "Finalized", "Locked"] as VisitStatus[]).map(
                    (s) => (
                      <KISButton
                        key={s}
                        title={s}
                        onPress={() => updateEncounterStatus(enc.id, s)}
                        variant={enc.status === s ? "primary" : "outline"}
                      />
                    )
                  )}
                </View>
              ))}
            </>
          )}
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
  backgroundColor: palette.bg,
  padding: spacing.sm,
  borderRadius: 12,
  marginVertical: spacing.xs,
});
