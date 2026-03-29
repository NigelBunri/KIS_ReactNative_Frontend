import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
} from "react-native";
import { useColorScheme } from "react-native";
import { HEALTH_THEME_SPACING } from "@/theme/health/spacing";
import { HEALTH_THEME_TYPOGRAPHY } from "@/theme/health/typography";
import { getHealthThemeColors } from "@/theme/health/colors";
import KISButton from "@/constants/KISButton";

type WaitingPatient = {
  id: string;
  name: string;
  joinedAt: number;
};

export default function VideoConsultationManager() {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === "light" ? "light" : "dark");
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  /* ================= CONFIG STATE ================= */

  const [enabled, setEnabled] = useState(true);
  const [pricePerMinute, setPricePerMinute] = useState("10");
  const [minDuration, setMinDuration] = useState("5");
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(true);

  /* ================= WAITING ROOM ================= */

  const [waitingList, setWaitingList] = useState<WaitingPatient[]>([
    { id: "1", name: "John Doe", joinedAt: Date.now() - 60000 },
    { id: "2", name: "Mary Smith", joinedAt: Date.now() - 180000 },
  ]);

  const admitPatient = (patient: WaitingPatient) => {
    setActiveSession(patient);
    setWaitingList((prev) => prev.filter((p) => p.id !== patient.id));
  };

  const removePatient = (id: string) => {
    setWaitingList((prev) => prev.filter((p) => p.id !== id));
  };

  /* ================= SESSION ================= */

  const [activeSession, setActiveSession] =
    useState<WaitingPatient | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);

  useEffect(() => {
    let interval: any;
    if (activeSession) {
      interval = setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  const endSession = () => {
    const minutes = Math.ceil(sessionSeconds / 60);
    const minBill = Math.max(minutes, Number(minDuration));
    const cost = minBill * Number(pricePerMinute);

    setTotalRevenue((prev) => prev + cost);
    setTotalSessions((prev) => prev + 1);
    setTotalMinutes((prev) => prev + minutes);

    setActiveSession(null);
    setSessionSeconds(0);
  };

  const liveCost =
    Math.max(Math.ceil(sessionSeconds / 60), Number(minDuration)) *
    Number(pricePerMinute);

  /* ================= UI ================= */

  return (
    <ScrollView style={{ padding: spacing.md }}>

      {/* ===== CONFIGURATION ===== */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Configuration
        </Text>

        <KISButton
          title={enabled ? "Disable Engine" : "Enable Engine"}
          onPress={() => setEnabled(!enabled)}
          variant="outline"
        />

        <TextInput
          placeholder="Price Per Minute (KISC)"
          keyboardType="numeric"
          value={pricePerMinute}
          onChangeText={setPricePerMinute}
          style={input(palette, spacing)}
        />

        <TextInput
          placeholder="Minimum Billable Duration (minutes)"
          keyboardType="numeric"
          value={minDuration}
          onChangeText={setMinDuration}
          style={input(palette, spacing)}
        />

        <KISButton
          title={recordingEnabled ? "Disable Recording" : "Enable Recording"}
          onPress={() => setRecordingEnabled(!recordingEnabled)}
          variant="outline"
        />

        <KISButton
          title={
            waitingRoomEnabled
              ? "Disable Waiting Room"
              : "Enable Waiting Room"
          }
          onPress={() => setWaitingRoomEnabled(!waitingRoomEnabled)}
          variant="outline"
        />
      </View>

      {/* ===== WAITING ROOM ===== */}
      {waitingRoomEnabled && (
        <View style={card(palette, spacing)}>
          <Text style={{ ...typography.h2, color: palette.text }}>
            Waiting Room
          </Text>

          {waitingList.map((patient) => {
            const waitTime = Math.floor(
              (Date.now() - patient.joinedAt) / 60000
            );

            return (
              <View
                key={patient.id}
                style={{
                  padding: spacing.sm,
                  marginVertical: spacing.xs,
                  borderRadius: 10,
                  backgroundColor: palette.surface,
                }}
              >
                <Text style={{ color: palette.text }}>
                  {patient.name}
                </Text>
                <Text style={{ color: palette.subtext }}>
                  Waiting: {waitTime} mins
                </Text>

                <KISButton
                  title="Admit"
                  onPress={() => admitPatient(patient)}
                />
                <KISButton
                  title="Remove"
                  onPress={() => removePatient(patient.id)}
                  variant="outline"
                />
              </View>
            );
          })}
        </View>
      )}

      {/* ===== ACTIVE SESSION ===== */}
      {activeSession && (
        <View style={card(palette, spacing)}>
          <Text style={{ ...typography.h2, color: palette.text }}>
            Live Session
          </Text>

          <Text style={{ color: palette.text }}>
            Patient: {activeSession.name}
          </Text>

          <Text style={{ color: palette.text }}>
            Duration: {Math.floor(sessionSeconds / 60)}:
            {(sessionSeconds % 60).toString().padStart(2, "0")}
          </Text>

          <Text style={{ color: palette.text }}>
            Current Cost: {liveCost} KISC
          </Text>

          <KISButton title="End Session" onPress={endSession} />
        </View>
      )}

      {/* ===== ANALYTICS ===== */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Analytics
        </Text>

        <Text style={{ color: palette.text }}>
          Total Sessions: {totalSessions}
        </Text>

        <Text style={{ color: palette.text }}>
          Total Minutes: {totalMinutes}
        </Text>

        <Text style={{ color: palette.text }}>
          Revenue Generated: {totalRevenue} KISC
        </Text>

        <Text style={{ color: palette.text }}>
          Avg Duration:{" "}
          {totalSessions === 0
            ? 0
            : Math.round(totalMinutes / totalSessions)}{" "}
          mins
        </Text>
      </View>

    </ScrollView>
  );
}

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
