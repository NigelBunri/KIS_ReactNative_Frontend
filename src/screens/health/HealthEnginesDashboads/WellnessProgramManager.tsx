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

type ActivityType = "Exercise" | "Diet" | "Meditation" | "Health Check";

type Activity = {
  id: string;
  name: string;
  type: ActivityType | string;
  points: number;
  completedBy: string[];
};

type WellnessProgram = {
  id: string;
  name: string;
  description: string;
  durationDays: number;
  requiredActivities: Activity[];
  rewardPoints: number;
};

type PatientEnrollment = {
  id: string;
  patientName: string;
  programId: string;
  completedActivities: string[];
  pointsEarned: number;
};

/* ================= HELPERS ================= */

const normalizeActivity = (raw: any): Activity => ({
  id: String(raw.id ?? ""),
  name: raw.name ?? raw.activity_name ?? "",
  type: raw.type ?? raw.activity_type ?? "Exercise",
  points: raw.points ?? raw.point_value ?? 10,
  completedBy: raw.completed_by ?? raw.completedBy ?? [],
});

const normalizeProgram = (raw: any): WellnessProgram => ({
  id: String(raw.id ?? ""),
  name: raw.name ?? raw.program_name ?? "",
  description: raw.description ?? "",
  durationDays: raw.duration_days ?? raw.durationDays ?? 7,
  rewardPoints: raw.reward_points ?? raw.rewardPoints ?? 50,
  requiredActivities: Array.isArray(raw.activities ?? raw.required_activities)
    ? (raw.activities ?? raw.required_activities).map(normalizeActivity)
    : [],
});

const normalizeEnrollment = (raw: any): PatientEnrollment => ({
  id: String(raw.id ?? ""),
  patientName:
    raw.patient_name ??
    raw.patientName ??
    raw.patient?.name ??
    raw.patient?.full_name ??
    "Unknown",
  programId: String(raw.program_id ?? raw.programId ?? raw.program ?? ""),
  completedActivities: raw.completed_activities ?? raw.completedActivities ?? [],
  pointsEarned: raw.points_earned ?? raw.pointsEarned ?? 0,
});

/* ================= COMPONENT ================= */

export default function WellnessProgramManager() {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === "light" ? "light" : "dark");
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  /* ================= CONFIG ================= */
  const [engineEnabled, setEngineEnabled] = useState(true);
  const [pointsPerActivity, setPointsPerActivity] = useState("10");
  const [maxActivitiesPerDay, setMaxActivitiesPerDay] = useState("5");
  const [autoApprove, setAutoApprove] = useState(true);

  /* ================= REMOTE DATA ================= */

  const [programs, setPrograms] = useState<WellnessProgram[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [enrollments, setEnrollments] = useState<PatientEnrollment[]>([]);

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
      const [sessionsRes, challengesRes] = await Promise.all([
        getRequest(
          ROUTES.healthOps.wellnessSessionStart.replace("/start/", "/"),
          {}
        ),
        getRequest(ROUTES.analytics.wellnessChallenges, {}),
      ]);

      if (sessionsRes.success) {
        const data = sessionsRes.data;
        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
          ? data.results
          : [];
        setEnrollments(list.map(normalizeEnrollment));
      }

      if (challengesRes.success) {
        const data = challengesRes.data;
        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
          ? data.results
          : [];
        setPrograms(list.map(normalizeProgram));

        // Flatten all activities from all programs
        const allActivities: Activity[] = list.flatMap((p: any) =>
          Array.isArray(p.activities ?? p.required_activities)
            ? (p.activities ?? p.required_activities).map(normalizeActivity)
            : []
        );
        setActivities(allActivities);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load wellness data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ================= PROGRAM MANAGEMENT ================= */

  const [newProgram, setNewProgram] = useState({
    name: "",
    description: "",
    durationDays: "7",
    rewardPoints: "50",
  });

  const addProgram = useCallback(async () => {
    if (!newProgram.name || !newProgram.description) return;

    const payload = {
      name: newProgram.name,
      description: newProgram.description,
      duration_days: Number(newProgram.durationDays),
      reward_points: Number(newProgram.rewardPoints),
    };

    const res = await postRequest(ROUTES.analytics.wellnessChallenges, payload);

    const program: WellnessProgram =
      res.success && res.data
        ? normalizeProgram(res.data)
        : {
            id: Date.now().toString(),
            name: newProgram.name,
            description: newProgram.description,
            durationDays: Number(newProgram.durationDays),
            rewardPoints: Number(newProgram.rewardPoints),
            requiredActivities: [],
          };

    setPrograms((prev) => [...prev, program]);
    setNewProgram({ name: "", description: "", durationDays: "7", rewardPoints: "50" });
  }, [newProgram]);

  /* ================= ACTIVITY MANAGEMENT ================= */

  const [newActivity, setNewActivity] = useState({
    name: "",
    type: "Exercise" as ActivityType,
    points: pointsPerActivity,
  });

  const addActivity = useCallback(
    async (programId: string) => {
      if (!newActivity.name) return;

      const payload = {
        name: newActivity.name,
        type: newActivity.type,
        points: Number(newActivity.points),
        program: programId,
      };

      const res = await patchRequest(ROUTES.analytics.wellnessChallenge(programId), {
        add_activity: payload,
      });

      const activity: Activity =
        res.success && res.data?.activity
          ? normalizeActivity(res.data.activity)
          : {
              id: Date.now().toString(),
              name: newActivity.name,
              type: newActivity.type,
              points: Number(newActivity.points),
              completedBy: [],
            };

      setActivities((prev) => [...prev, activity]);
      setPrograms((prev) =>
        prev.map((p) =>
          p.id === programId
            ? { ...p, requiredActivities: [...p.requiredActivities, activity] }
            : p
        )
      );
      setNewActivity({ name: "", type: "Exercise", points: pointsPerActivity });
    },
    [newActivity, pointsPerActivity]
  );

  /* ================= PATIENT ENROLLMENT ================= */

  const [patientName, setPatientName] = useState("");

  const enrollPatient = useCallback(
    async (programId: string) => {
      if (!patientName) return;

      const res = await postRequest(ROUTES.healthOps.wellnessSessionStart, {
        patient_name: patientName,
        program_id: programId,
      });

      const enrollment: PatientEnrollment =
        res.success && res.data
          ? normalizeEnrollment(res.data)
          : {
              id: Date.now().toString(),
              patientName,
              programId,
              completedActivities: [],
              pointsEarned: 0,
            };

      setEnrollments((prev) => [...prev, enrollment]);
      setPatientName("");
    },
    [patientName]
  );

  const completeActivity = useCallback(
    async (enrollmentId: string, activityId: string) => {
      const enrollment = enrollments.find((e) => e.id === enrollmentId);
      if (!enrollment || enrollment.completedActivities.includes(activityId)) return;

      const res = await patchRequest(
        ROUTES.healthOps.wellnessSessionActivity(enrollmentId),
        { activity_id: activityId, completed: true }
      );

      const activityPoints =
        activities.find((a) => a.id === activityId)?.points ?? 0;

      if (res.success || true) {
        setEnrollments((prev) =>
          prev.map((e) => {
            if (e.id === enrollmentId && !e.completedActivities.includes(activityId)) {
              return {
                ...e,
                completedActivities: [...e.completedActivities, activityId],
                pointsEarned: e.pointsEarned + activityPoints,
              };
            }
            return e;
          })
        );

        if (autoApprove) {
          setActivities((prev) =>
            prev.map((a) =>
              a.id === activityId
                ? { ...a, completedBy: [...a.completedBy, enrollmentId] }
                : a
            )
          );
        }
      }
    },
    [enrollments, activities, autoApprove]
  );

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
          Wellness Program Configuration
        </Text>
        <KISButton
          title={engineEnabled ? "Disable Engine" : "Enable Engine"}
          onPress={() => setEngineEnabled(!engineEnabled)}
          variant="outline"
        />
        <TextInput
          placeholder="Points per Activity"
          value={pointsPerActivity}
          keyboardType="numeric"
          onChangeText={setPointsPerActivity}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Max Activities per Day"
          value={maxActivitiesPerDay}
          keyboardType="numeric"
          onChangeText={setMaxActivitiesPerDay}
          style={input(palette, spacing)}
        />
        <KISButton
          title={
            autoApprove ? "Disable Auto-Approval" : "Enable Auto-Approval"
          }
          onPress={() => setAutoApprove(!autoApprove)}
          variant="outline"
        />
      </View>

      {/* PROGRAMS */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Wellness Programs
        </Text>

        {programs.length === 0 && (
          <Text style={{ color: palette.subtext }}>No programs loaded.</Text>
        )}

        {programs.map((program) => (
          <View key={program.id} style={itemCard(palette, spacing)}>
            <Text style={{ color: palette.text }}>{program.name}</Text>
            <Text style={{ color: palette.subtext }}>
              Duration: {program.durationDays} days - Reward:{" "}
              {program.rewardPoints} pts
            </Text>

            {/* Activities */}
            <Text style={{ ...typography.h3, color: palette.text }}>
              Activities
            </Text>
            {program.requiredActivities.map((activity) => (
              <Text key={activity.id} style={{ color: palette.text }}>
                - {activity.name} ({activity.type}) - {activity.points} pts
              </Text>
            ))}

            {/* Add Activity */}
            <TextInput
              placeholder="Activity Name"
              value={newActivity.name}
              onChangeText={(text) =>
                setNewActivity((prev) => ({ ...prev, name: text }))
              }
              style={input(palette, spacing)}
            />
            <TextInput
              placeholder="Points"
              keyboardType="numeric"
              value={String(newActivity.points)}
              onChangeText={(text) =>
                setNewActivity((prev) => ({ ...prev, points: text }))
              }
              style={input(palette, spacing)}
            />
            <KISButton
              title="Add Activity"
              onPress={() => addActivity(program.id)}
            />
          </View>
        ))}

        {/* Add Program */}
        <Text style={{ ...typography.h3, color: palette.text }}>
          Add New Program
        </Text>
        <TextInput
          placeholder="Program Name"
          value={newProgram.name}
          onChangeText={(text) =>
            setNewProgram((prev) => ({ ...prev, name: text }))
          }
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Description"
          value={newProgram.description}
          onChangeText={(text) =>
            setNewProgram((prev) => ({ ...prev, description: text }))
          }
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Duration (days)"
          value={newProgram.durationDays}
          keyboardType="numeric"
          onChangeText={(text) =>
            setNewProgram((prev) => ({ ...prev, durationDays: text }))
          }
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Reward Points"
          value={newProgram.rewardPoints}
          keyboardType="numeric"
          onChangeText={(text) =>
            setNewProgram((prev) => ({ ...prev, rewardPoints: text }))
          }
          style={input(palette, spacing)}
        />
        <KISButton title="Add Program" onPress={addProgram} />
      </View>

      {/* PATIENT ENROLLMENT */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Enroll Patient
        </Text>
        <TextInput
          placeholder="Patient Name"
          value={patientName}
          onChangeText={setPatientName}
          style={input(palette, spacing)}
        />
        {programs.map((program) => (
          <KISButton
            key={program.id}
            title={`Enroll in ${program.name}`}
            onPress={() => enrollPatient(program.id)}
          />
        ))}
      </View>

      {/* PATIENT PROGRESS */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Patient Progress
        </Text>

        {enrollments.length === 0 && (
          <Text style={{ color: palette.subtext }}>No enrollments yet.</Text>
        )}

        {enrollments.map((enroll) => {
          const program = programs.find((p) => p.id === enroll.programId);
          return (
            <View key={enroll.id} style={itemCard(palette, spacing)}>
              <Text style={{ color: palette.text }}>
                {enroll.patientName} - {program?.name ?? "Unknown Program"}
              </Text>
              <Text style={{ color: palette.subtext }}>
                Points Earned: {enroll.pointsEarned}
              </Text>

              <Text style={{ ...typography.h3, color: palette.text }}>
                Complete Activity
              </Text>
              {program?.requiredActivities.map((activity) => (
                <KISButton
                  key={activity.id}
                  title={activity.name}
                  onPress={() => completeActivity(enroll.id, activity.id)}
                  variant={
                    enroll.completedActivities.includes(activity.id)
                      ? "primary"
                      : "outline"
                  }
                />
              ))}
            </View>
          );
        })}
      </View>

      {/* ANALYTICS */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Wellness Analytics
        </Text>
        <Text style={{ color: palette.text }}>
          Total Programs: {programs.length}
        </Text>
        <Text style={{ color: palette.text }}>
          Total Enrollments: {enrollments.length}
        </Text>
        <Text style={{ color: palette.text }}>
          Total Activities: {activities.length}
        </Text>
        <Text style={{ color: palette.text }}>
          Total Points Earned:{" "}
          {enrollments.reduce((sum, e) => sum + e.pointsEarned, 0)}
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
