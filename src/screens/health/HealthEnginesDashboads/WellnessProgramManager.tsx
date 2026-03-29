import React, { useState } from "react";
import { View, Text, ScrollView, TextInput } from "react-native";
import { useColorScheme } from "react-native";
import { HEALTH_THEME_SPACING } from "@/theme/health/spacing";
import { HEALTH_THEME_TYPOGRAPHY } from "@/theme/health/typography";
import { getHealthThemeColors } from "@/theme/health/colors";
import KISButton from "@/constants/KISButton";

/* ================= TYPES ================= */

type ActivityType = "Exercise" | "Diet" | "Meditation" | "Health Check";

type Activity = {
  id: string;
  name: string;
  type: ActivityType;
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

  /* ================= PROGRAM MANAGEMENT ================= */
  const [programs, setPrograms] = useState<WellnessProgram[]>([]);
  const [newProgram, setNewProgram] = useState({ name: "", description: "", durationDays: "7", rewardPoints: "50" });

  const addProgram = () => {
    if (!newProgram.name || !newProgram.description) return;
    const program: WellnessProgram = {
      id: Date.now().toString(),
      name: newProgram.name,
      description: newProgram.description,
      durationDays: Number(newProgram.durationDays),
      rewardPoints: Number(newProgram.rewardPoints),
      requiredActivities: [],
    };
    setPrograms(prev => [...prev, program]);
    setNewProgram({ name: "", description: "", durationDays: "7", rewardPoints: "50" });
  };

  /* ================= ACTIVITY MANAGEMENT ================= */
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newActivity, setNewActivity] = useState({ name: "", type: "Exercise" as ActivityType, points: String(pointsPerActivity) });

  const addActivity = (programId: string) => {
    if (!newActivity.name) return;
    const activity: Activity = {
      id: Date.now().toString(),
      name: newActivity.name,
      type: newActivity.type,
      points: Number(newActivity.points),
      completedBy: [],
    };
    setActivities(prev => [...prev, activity]);
    setPrograms(prev => prev.map(p => p.id === programId ? { ...p, requiredActivities: [...p.requiredActivities, activity] } : p));
    setNewActivity({ name: "", type: "Exercise", points: String(pointsPerActivity) });
  };

  /* ================= PATIENT ENROLLMENT ================= */
  const [enrollments, setEnrollments] = useState<PatientEnrollment[]>([]);
  const [patientName, setPatientName] = useState("");

  const enrollPatient = (programId: string) => {
    if (!patientName) return;
    const enrollment: PatientEnrollment = {
      id: Date.now().toString(),
      patientName,
      programId,
      completedActivities: [],
      pointsEarned: 0,
    };
    setEnrollments(prev => [...prev, enrollment]);
    setPatientName("");
  };

  const completeActivity = (enrollmentId: string, activityId: string) => {
    setEnrollments(prev => prev.map(e => {
      if (e.id === enrollmentId && !e.completedActivities.includes(activityId)) {
        const activityPoints = activities.find(a => a.id === activityId)?.points || 0;
        return { ...e, completedActivities: [...e.completedActivities, activityId], pointsEarned: e.pointsEarned + activityPoints };
      }
      return e;
    }));
    if (autoApprove) {
      setActivities(prev => prev.map(a => a.id === activityId ? { ...a, completedBy: [...a.completedBy, enrollmentId] } : a));
    }
  };

  /* ================= UI ================= */

  return (
    <ScrollView style={{ padding: spacing.md }}>

      {/* CONFIGURATION */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Wellness Program Configuration</Text>
        <KISButton
          title={engineEnabled ? "Disable Engine" : "Enable Engine"}
          onPress={() => setEngineEnabled(!engineEnabled)}
          variant="outline"
        />
        <TextInput placeholder="Points per Activity" value={pointsPerActivity} keyboardType="numeric" onChangeText={setPointsPerActivity} style={input(palette, spacing)} />
        <TextInput placeholder="Max Activities per Day" value={maxActivitiesPerDay} keyboardType="numeric" onChangeText={setMaxActivitiesPerDay} style={input(palette, spacing)} />
        <KISButton title={autoApprove ? "Disable Auto-Approval" : "Enable Auto-Approval"} onPress={() => setAutoApprove(!autoApprove)} variant="outline" />
      </View>

      {/* PROGRAMS */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Wellness Programs</Text>
        {programs.map(program => (
          <View key={program.id} style={itemCard(palette, spacing)}>
            <Text style={{ color: palette.text }}>{program.name}</Text>
            <Text style={{ color: palette.subtext }}>Duration: {program.durationDays} days • Reward: {program.rewardPoints} pts</Text>

            {/* Activities */}
            <Text style={{ ...typography.h3, color: palette.text }}>Activities</Text>
            {program.requiredActivities.map(activity => (
              <Text key={activity.id} style={{ color: palette.text }}>• {activity.name} ({activity.type}) - {activity.points} pts</Text>
            ))}

            {/* Add Activity */}
            <TextInput placeholder="Activity Name" value={newActivity.name} onChangeText={text => setNewActivity(prev => ({ ...prev, name: text }))} style={input(palette, spacing)} />
            <TextInput placeholder="Points" keyboardType="numeric" value={String(newActivity.points)} onChangeText={text => setNewActivity(prev => ({ ...prev, points: text }))} style={input(palette, spacing)} />
            <KISButton title="Add Activity" onPress={() => addActivity(program.id)} />
          </View>
        ))}

        {/* Add Program */}
        <Text style={{ ...typography.h3, color: palette.text }}>Add New Program</Text>
        <TextInput placeholder="Program Name" value={newProgram.name} onChangeText={text => setNewProgram(prev => ({ ...prev, name: text }))} style={input(palette, spacing)} />
        <TextInput placeholder="Description" value={newProgram.description} onChangeText={text => setNewProgram(prev => ({ ...prev, description: text }))} style={input(palette, spacing)} />
        <TextInput placeholder="Duration (days)" value={newProgram.durationDays} keyboardType="numeric" onChangeText={text => setNewProgram(prev => ({ ...prev, durationDays: text }))} style={input(palette, spacing)} />
        <TextInput placeholder="Reward Points" value={newProgram.rewardPoints} keyboardType="numeric" onChangeText={text => setNewProgram(prev => ({ ...prev, rewardPoints: text }))} style={input(palette, spacing)} />
        <KISButton title="Add Program" onPress={addProgram} />
      </View>

      {/* PATIENT ENROLLMENT */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Enroll Patient</Text>
        <TextInput placeholder="Patient Name" value={patientName} onChangeText={setPatientName} style={input(palette, spacing)} />
        {programs.map(program => (
          <KISButton key={program.id} title={`Enroll in ${program.name}`} onPress={() => enrollPatient(program.id)} />
        ))}
      </View>

      {/* PATIENT PROGRESS */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Patient Progress</Text>
        {enrollments.map(enroll => {
          const program = programs.find(p => p.id === enroll.programId);
          return (
            <View key={enroll.id} style={itemCard(palette, spacing)}>
              <Text style={{ color: palette.text }}>{enroll.patientName} - {program?.name}</Text>
              <Text style={{ color: palette.subtext }}>Points Earned: {enroll.pointsEarned}</Text>

              <Text style={{ ...typography.h3, color: palette.text }}>Complete Activity</Text>
              {program?.requiredActivities.map(activity => (
                <KISButton
                  key={activity.id}
                  title={activity.name}
                  onPress={() => completeActivity(enroll.id, activity.id)}
                  variant={enroll.completedActivities.includes(activity.id) ? "primary" : "outline"}
                />
              ))}
            </View>
          );
        })}
      </View>

      {/* ANALYTICS */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Wellness Analytics</Text>
        <Text style={{ color: palette.text }}>Total Programs: {programs.length}</Text>
        <Text style={{ color: palette.text }}>Total Enrollments: {enrollments.length}</Text>
        <Text style={{ color: palette.text }}>Total Activities: {activities.length}</Text>
        <Text style={{ color: palette.text }}>Total Points Earned: {enrollments.reduce((sum, e) => sum + e.pointsEarned, 0)}</Text>
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
