import React, { FC, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HEALTH_THEME_SPACING } from "@/theme/health/spacing";
import { HEALTH_THEME_TYPOGRAPHY } from "@/theme/health/typography";
import { getHealthThemeColors } from "@/theme/health/colors";
import KISButton from "@/constants/KISButton";
import {
  createInstitutionEngineManagedItem,
  fetchInstitutionEngineManagedItems,
  updateInstitutionEngineManagedItem,
} from "@/services/healthOpsEngineManagerService";

/* ================= TYPES ================= */

type Props = { institutionId: string; engineKey: string };

type Channel = "Push" | "SMS" | "Email" | "In-App";
type Priority = "Low" | "Normal" | "High" | "Critical";
type Status = "Scheduled" | "Sent" | "Delivered" | "Read" | "Failed";

interface NotificationTemplate {
  id: string;
  name: string;
  message: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  recipient: string;
  channel: Channel;
  priority: Priority;
  scheduled_for: string;
  status: Status;
  read: boolean;
}

/* ================= COMPONENT ================= */

const NotificationReminderManager = ({ institutionId, engineKey }: Props) => {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === "light" ? "light" : "dark");
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  /* ================= CONFIG ================= */

  const [engineEnabled, setEngineEnabled] = useState<boolean>(true);
  const [engineConfigItemId, setEngineConfigItemId] = useState<string | null>(null);
  const [autoSendEnabled, setAutoSendEnabled] = useState<boolean>(true);

  /* ================= TEMPLATES ================= */

  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState<string>("");
  const [templateMessage, setTemplateMessage] = useState<string>("");

  // NOTE: the backend's reminders/sessions/start/ endpoint only supports POST
  // and requires a workflow_session_id tied to an active clinical workflow —
  // there is no standalone "template" list/create API yet. Rather than call
  // an endpoint that will always 404/400, surface a clear "coming soon" state.
  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    setTemplates([]);
    setLoadingTemplates(false);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (!institutionId || !engineKey) return;
    fetchInstitutionEngineManagedItems(institutionId, engineKey, { itemKind: 'engine_config' })
      .then((res: any) => {
        const rows = Array.isArray(res?.data?.results) ? res.data.results : [];
        const cfg = rows.find((r: any) => r?.name === 'is_active');
        if (cfg) {
          setEngineConfigItemId(String(cfg.id));
          setEngineEnabled(cfg.value_bool !== false);
        }
      })
      .catch(() => undefined);
  }, [institutionId, engineKey]);

  const toggleEngine = useCallback(async () => {
    const next = !engineEnabled;
    setEngineEnabled(next);
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
      setEngineEnabled(!next);
    }
  }, [engineConfigItemId, engineEnabled, engineKey, institutionId]);

  const createTemplate = async () => {
    if (!templateName || !templateMessage) return;
    Alert.alert(
      "Coming soon",
      "Reusable notification templates are not available yet. You can still send one-off notifications below."
    );
  };

  /* ================= NOTIFICATIONS ================= */

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);

  const [title, setTitle] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [channel, setChannel] = useState<Channel>("Push");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [scheduleDate, setScheduleDate] = useState<string>("");

  // NOTE: same backend limitation as templates above — reminders/sessions/start/
  // requires a workflow_session_id and does not support GET for listing history.
  // There is no freeform notification-broadcast API yet, so we surface a clear
  // "coming soon" state instead of silently failing requests.
  const fetchNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    setNotifications([]);
    setLoadingNotifications(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const createNotification = async () => {
    if (!title || !message || !recipient) return;
    Alert.alert(
      "Coming soon",
      "Sending standalone notifications is not available yet. Reminders are currently triggered automatically from clinical workflows."
    );
  };

  const updateStatus = async (id: string, status: Status) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status } : n))
    );
  };

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, status: "Read" } : n))
    );
  };

  /* ================= ANALYTICS ================= */

  const totalNotifications = notifications.length;
  const deliveredCount = notifications.filter((n) => n.status === "Delivered").length;
  const readCount = notifications.filter((n) => n.read).length;
  const scheduledCount = notifications.filter((n) => n.status === "Scheduled").length;

  /* ================= UI ================= */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.md }}
    >
      {/* CONFIGURATION */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Notification Engine Configuration
        </Text>

        <KISButton
          title={engineEnabled ? "Disable Engine" : "Enable Engine"}
          onPress={() => { toggleEngine().catch(() => undefined); }}
          variant="outline"
        />
        <KISButton
          title={autoSendEnabled ? "Disable Auto Send" : "Enable Auto Send"}
          onPress={() => {
            setAutoSendEnabled(!autoSendEnabled);
            Alert.alert(
              "Coming soon",
              "Auto-send configuration will be persisted once a notification engine settings endpoint is available."
            );
          }}
          variant="outline"
        />
      </View>

      {/* TEMPLATE MANAGEMENT */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Create Template
        </Text>

        <TextInput
          placeholder="Template Name"
          value={templateName}
          onChangeText={setTemplateName}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Template Message"
          value={templateMessage}
          onChangeText={setTemplateMessage}
          style={input(palette, spacing)}
        />

        <KISButton
          title={savingTemplate ? "Saving…" : "Save Template"}
          onPress={createTemplate}
        />

        {loadingTemplates ? (
          <ActivityIndicator color={palette.primary} />
        ) : (
          templates.map((t) => (
            <View key={t.id} style={item(palette, spacing)}>
              <Text style={{ color: palette.text }}>{t.name}</Text>
              <Text style={{ color: palette.subtext }}>{t.message}</Text>
              <KISButton
                title="Use Template"
                onPress={() => setMessage(t.message)}
                variant="outline"
              />
            </View>
          ))
        )}
      </View>

      {/* CREATE NOTIFICATION */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Create Notification
        </Text>

        <TextInput
          placeholder="Title"
          value={title}
          onChangeText={setTitle}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Recipient (Patient Name / Group)"
          value={recipient}
          onChangeText={setRecipient}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Message"
          value={message}
          onChangeText={setMessage}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Schedule Date (optional)"
          value={scheduleDate}
          onChangeText={setScheduleDate}
          style={input(palette, spacing)}
        />

        {/* CHANNEL SELECT */}
        {(["Push", "SMS", "Email", "In-App"] as Channel[]).map((c) => (
          <KISButton
            key={c}
            title={c}
            onPress={() => setChannel(c)}
            variant={channel === c ? "primary" : "outline"}
          />
        ))}

        {/* PRIORITY */}
        {(["Low", "Normal", "High", "Critical"] as Priority[]).map((p) => (
          <KISButton
            key={p}
            title={p}
            onPress={() => setPriority(p)}
            variant={priority === p ? "primary" : "outline"}
          />
        ))}

        <KISButton
          title={sendingNotification ? "Sending…" : "Send Notification"}
          onPress={createNotification}
        />
      </View>

      {/* NOTIFICATION LIST */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Notification History
        </Text>

        {loadingNotifications ? (
          <ActivityIndicator color={palette.primary} />
        ) : notifications.length === 0 ? (
          <Text style={{ color: palette.subtext }}>No notifications yet.</Text>
        ) : (
          notifications.map((n) => (
            <View key={n.id} style={item(palette, spacing)}>
              <Text style={{ color: palette.text }}>
                {n.title} ({n.channel})
              </Text>
              <Text style={{ color: palette.subtext }}>
                To: {n.recipient} | Priority: {n.priority}
              </Text>
              <Text style={{ color: palette.subtext }}>
                Status: {n.status}
              </Text>

              <KISButton
                title="Mark Delivered"
                onPress={() => updateStatus(n.id, "Delivered")}
                variant="outline"
              />
              <KISButton
                title="Mark Read"
                onPress={() => markAsRead(n.id)}
                variant="outline"
              />
            </View>
          ))
        )}
      </View>

      {/* ANALYTICS */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Notification Analytics
        </Text>

        <Text style={{ color: palette.text }}>
          Total Notifications: {totalNotifications}
        </Text>
        <Text style={{ color: palette.text }}>Delivered: {deliveredCount}</Text>
        <Text style={{ color: palette.text }}>Read: {readCount}</Text>
        <Text style={{ color: palette.text }}>Scheduled: {scheduledCount}</Text>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationReminderManager;

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

const item = (palette: any, spacing: any) => ({
  backgroundColor: palette.bg,
  padding: spacing.sm,
  borderRadius: 12,
  marginVertical: spacing.xs,
});
