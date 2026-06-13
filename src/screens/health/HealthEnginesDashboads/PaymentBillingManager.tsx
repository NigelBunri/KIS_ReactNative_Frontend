import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View, useColorScheme } from "react-native";
import { HEALTH_THEME_SPACING } from "@/theme/health/spacing";
import { HEALTH_THEME_TYPOGRAPHY } from "@/theme/health/typography";
import { getHealthThemeColors } from "@/theme/health/colors";
import KISButton from "@/constants/KISButton";
import { getRequest } from "@/network/get";
import { postRequest } from "@/network/post";
import ROUTES from "@/network";

type Props = {
  institutionId: string;
  engineKey: string;
};

type BillingSession = {
  id: string;
  patient_name: string;
  amount: string;
  currency: string;
  status: string;
  created_at: string;
};

const card = (palette: any, spacing: any) => ({
  backgroundColor: palette.card,
  borderRadius: 16,
  padding: spacing.md,
  marginBottom: spacing.md,
  gap: spacing.sm,
} as const);

const input = (palette: any, spacing: any) => ({
  borderWidth: 1,
  borderColor: palette.divider,
  borderRadius: 10,
  padding: spacing.sm,
  color: palette.text,
  backgroundColor: palette.surface,
  marginTop: spacing.xs,
} as const);

export default function PaymentBillingManager({ institutionId }: Props) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === "light" ? "light" : "dark");
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [engineEnabled, setEngineEnabled] = useState(true);
  const [sessions, setSessions] = useState<BillingSession[]>([]);
  const [loading, setLoading] = useState(false);

  const [newBill, setNewBill] = useState({
    patientName: "",
    serviceCode: "",
    amount: "",
    currency: "USD",
    notes: "",
  });

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(
        `${ROUTES.healthOps.billingSessions}?institution=${institutionId}`,
      );
      if (Array.isArray(res?.results)) {
        setSessions(res.results);
      } else if (Array.isArray(res?.data)) {
        setSessions(res.data);
      }
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleStartBilling = async () => {
    if (!newBill.patientName || !newBill.amount) {
      Alert.alert("Validation", "Patient name and amount are required.");
      return;
    }
    const res = await postRequest(
      ROUTES.healthOps.billingSessionStart,
      {
        institution: institutionId,
        patient_name: newBill.patientName,
        service_code: newBill.serviceCode,
        amount: newBill.amount,
        currency: newBill.currency,
        notes: newBill.notes,
      },
      { errorMessage: "Unable to start billing session." },
    );
    if (res?.id) {
      Alert.alert("Billing started", `Session ${res.id.slice(0, 8)}… created.`);
      setNewBill({ patientName: "", serviceCode: "", amount: "", currency: "USD", notes: "" });
      loadSessions();
    } else {
      Alert.alert("Billing", res?.message ?? "Unable to start session.");
    }
  };

  const STATUS_COLOR: Record<string, string> = {
    waiting: "#F59E0B",
    paid: "#10B981",
    failed: "#EF4444",
    refunded: palette.subtext,
  };

  return (
    <ScrollView style={{ padding: spacing.md }}>
      {/* Engine toggle */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Payment & Billing Configuration</Text>
        <KISButton
          title={engineEnabled ? "Disable Engine" : "Enable Engine"}
          onPress={() => setEngineEnabled(!engineEnabled)}
          variant="outline"
        />
        <Text style={{ color: palette.subtext, fontSize: 12 }}>
          Currency: USD · Provider: Flutterwave · Receipts: auto-generated
        </Text>
      </View>

      {/* New billing session */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Start Billing Session</Text>
        <TextInput
          placeholder="Patient name"
          placeholderTextColor={palette.subtext}
          value={newBill.patientName}
          onChangeText={v => setNewBill(b => ({ ...b, patientName: v }))}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Service code (optional)"
          placeholderTextColor={palette.subtext}
          value={newBill.serviceCode}
          onChangeText={v => setNewBill(b => ({ ...b, serviceCode: v }))}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Amount (USD)"
          placeholderTextColor={palette.subtext}
          value={newBill.amount}
          keyboardType="decimal-pad"
          onChangeText={v => setNewBill(b => ({ ...b, amount: v }))}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Notes (optional)"
          placeholderTextColor={palette.subtext}
          value={newBill.notes}
          onChangeText={v => setNewBill(b => ({ ...b, notes: v }))}
          style={input(palette, spacing)}
        />
        <KISButton title="Create Billing Session" onPress={handleStartBilling} />
      </View>

      {/* Session list */}
      <View style={card(palette, spacing)}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ ...typography.h2, color: palette.text }}>Billing Sessions</Text>
          <KISButton title="Refresh" size="sm" variant="outline" onPress={loadSessions} />
        </View>
        {loading && (
          <Text style={{ color: palette.subtext }}>Loading…</Text>
        )}
        {!loading && sessions.length === 0 && (
          <Text style={{ color: palette.subtext }}>No billing sessions yet.</Text>
        )}
        {sessions.map(session => (
          <View
            key={session.id}
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 12,
              padding: spacing.sm,
              gap: spacing.xs,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: palette.text, fontWeight: "700" }}>{session.patient_name}</Text>
              <Text
                style={{
                  color: STATUS_COLOR[session.status] ?? palette.text,
                  fontWeight: "700",
                  fontSize: 12,
                  textTransform: "uppercase",
                }}
              >
                {session.status}
              </Text>
            </View>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>
              {session.currency} {session.amount} · {new Date(session.created_at).toLocaleDateString()}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 11 }}>ID: {session.id.slice(0, 8)}…</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
