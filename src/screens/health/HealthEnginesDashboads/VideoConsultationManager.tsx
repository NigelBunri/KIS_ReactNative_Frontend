import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Alert,
  TextInput,
  ScrollView,
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

type VideoSession = {
  id: string;
  patient_name?: string;
  patient?: { name?: string; full_name?: string };
  status: string;
  started_at?: string;
  ended_at?: string;
  duration_minutes?: number;
  price?: number;
  joined_at?: number;
};

type AnalyticsSummary = {
  total_sessions: number;
  total_minutes: number;
  revenue: number;
};

type Props = { institutionId: string; engineKey: string };

export default function VideoConsultationManager({ institutionId, engineKey }: Props) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === "light" ? "light" : "dark");
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  /* ================= CONFIG STATE ================= */

  const [enabled, setEnabled] = useState(true);
  const [engineConfigItemId, setEngineConfigItemId] = useState<string | null>(null);
  const [pricePerMinute, setPricePerMinute] = useState("10");
  const [minDuration, setMinDuration] = useState("5");
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(true);

  /* ================= REMOTE DATA ================= */

  const [waitingList, setWaitingList] = useState<VideoSession[]>([]);
  const [activeSession, setActiveSession] = useState<VideoSession | null>(null);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary>({
    total_sessions: 0,
    total_minutes: 0,
    revenue: 0,
  });

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ================= SESSION TIMER ================= */

  const [sessionSeconds, setSessionSeconds] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (activeSession) {
      interval = setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  /* ================= FETCH ================= */

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [waitingRes, analyticsRes] = await Promise.all([
        getRequest(ROUTES.telemedicine.sessions, {
          params: { status: "waiting" },
        }),
        getRequest(ROUTES.telemedicine.sessions, {
          params: { status: "completed", summary: "true" },
        }),
      ]);

      if (waitingRes.success) {
        const data = waitingRes.data;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
          ? data.results
          : [];
        setWaitingList(list);
      }

      if (analyticsRes.success) {
        const data = analyticsRes.data;
        if (data && typeof data === "object" && !Array.isArray(data)) {
          if ("total_sessions" in data || "total_minutes" in data || "revenue" in data) {
            setAnalyticsSummary({
              total_sessions: data.total_sessions ?? 0,
              total_minutes: data.total_minutes ?? 0,
              revenue: data.revenue ?? 0,
            });
          } else {
            const results: VideoSession[] = Array.isArray(data.results)
              ? data.results
              : Array.isArray(data)
              ? data
              : [];
            const totalSessions = results.length;
            const totalMinutes = results.reduce(
              (s: number, r: VideoSession) => s + (r.duration_minutes ?? 0),
              0
            );
            const revenue = results.reduce(
              (s: number, r: VideoSession) => s + (r.price ?? 0),
              0
            );
            setAnalyticsSummary({ total_sessions: totalSessions, total_minutes: totalMinutes, revenue });
          }
        }
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load video sessions.");
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
          setEnabled(cfg.value_bool !== false);
        }
      })
      .catch(() => undefined);
  }, [institutionId, engineKey]);

  const toggleEngine = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);
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
      setEnabled(!next);
    }
  }, [engineConfigItemId, enabled, engineKey, institutionId]);

  /* ================= ACTIONS ================= */

  const admitPatient = useCallback(async (session: VideoSession) => {
    const res = await postRequest(ROUTES.telemedicine.sessionStart(session.id), {});
    if (res.success) {
      setActiveSession(session);
      setSessionSeconds(0);
      setWaitingList((prev) => prev.filter((p) => p.id !== session.id));
    }
  }, []);

  const removePatient = useCallback(async (id: string) => {
    const res = await patchRequest(ROUTES.telemedicine.session(id), { status: "cancelled" });
    if (res.success) {
      setWaitingList((prev) => prev.filter((p) => p.id !== id));
    }
  }, []);

  const endSession = useCallback(async () => {
    if (!activeSession) return;
    const minutes = Math.ceil(sessionSeconds / 60);
    const minBill = Math.max(minutes, Number(minDuration));
    const cost = minBill * Number(pricePerMinute);

    const res = await postRequest(ROUTES.telemedicine.sessionEnd(activeSession.id), {
      duration_minutes: minutes,
      price: cost,
    });

    if (res.success) {
      setAnalyticsSummary((prev) => ({
        total_sessions: prev.total_sessions + 1,
        total_minutes: prev.total_minutes + minutes,
        revenue: prev.revenue + cost,
      }));
      setActiveSession(null);
      setSessionSeconds(0);
    }
  }, [activeSession, sessionSeconds, minDuration, pricePerMinute]);

  const liveCost =
    Math.max(Math.ceil(sessionSeconds / 60), Number(minDuration)) *
    Number(pricePerMinute);

  /* ================= UI ================= */

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.md }}>
          <Text style={{ color: palette.text, marginBottom: spacing.md }}>{error}</Text>
          <KISButton title="Retry" onPress={() => fetchData()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
    <ScrollView
      style={{ padding: spacing.md }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} />
      }
    >

      {/* ===== CONFIGURATION ===== */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Configuration
        </Text>

        <KISButton
          title={enabled ? "Disable Engine" : "Enable Engine"}
          onPress={() => { toggleEngine().catch(() => undefined); }}
          variant="outline"
        />

        <TextInput
          placeholder="Price Per Minute (USD)"
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

          {waitingList.length === 0 && (
            <Text style={{ color: palette.subtext }}>No patients waiting.</Text>
          )}

          {waitingList.map((session) => {
            const joinedAt = session.joined_at ?? Date.now();
            const waitTime = Math.floor((Date.now() - joinedAt) / 60000);
            const patientName =
              session.patient_name ||
              session.patient?.full_name ||
              session.patient?.name ||
              "Unknown Patient";

            return (
              <View
                key={session.id}
                style={{
                  padding: spacing.sm,
                  marginVertical: spacing.xs,
                  borderRadius: 10,
                  backgroundColor: palette.surface,
                }}
              >
                <Text style={{ color: palette.text }}>{patientName}</Text>
                <Text style={{ color: palette.subtext }}>
                  Waiting: {waitTime} mins
                </Text>

                <KISButton
                  title="Admit"
                  onPress={() => admitPatient(session)}
                />
                <KISButton
                  title="Remove"
                  onPress={() => removePatient(session.id)}
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
            Patient:{" "}
            {activeSession.patient_name ||
              activeSession.patient?.full_name ||
              activeSession.patient?.name ||
              "Unknown"}
          </Text>

          <Text style={{ color: palette.text }}>
            Duration: {Math.floor(sessionSeconds / 60)}:
            {(sessionSeconds % 60).toString().padStart(2, "0")}
          </Text>

          <Text style={{ color: palette.text }}>
            Current Cost: {liveCost} USD
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
          Total Sessions: {analyticsSummary.total_sessions}
        </Text>

        <Text style={{ color: palette.text }}>
          Total Minutes: {analyticsSummary.total_minutes}
        </Text>

        <Text style={{ color: palette.text }}>
          Revenue Generated: {analyticsSummary.revenue} USD
        </Text>

        <Text style={{ color: palette.text }}>
          Avg Duration:{" "}
          {analyticsSummary.total_sessions === 0
            ? 0
            : Math.round(
                analyticsSummary.total_minutes / analyticsSummary.total_sessions
              )}{" "}
          mins
        </Text>
      </View>

    </ScrollView>
    </SafeAreaView>
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
