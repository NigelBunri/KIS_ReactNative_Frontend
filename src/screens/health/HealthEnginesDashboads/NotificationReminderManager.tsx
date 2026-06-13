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

import { HEALTH_THEME_SPACING } from "@/theme/health/spacing";
import { HEALTH_THEME_TYPOGRAPHY } from "@/theme/health/typography";
import { getHealthThemeColors } from "@/theme/health/colors";
import KISButton from "@/constants/KISButton";
import ROUTES from "@/network";
import { getRequest } from "@/network/get";
import { postRequest } from "@/network/post";
import { patchRequest } from "@/network/patch";

/* ================= TYPES ================= */

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

const NotificationReminderManager: FC = () => {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === "light" ? "light" : "dark");
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  /* ================= CONFIG ================= */

  const [engineEnabled, setEngineEnabled] = useState<boolean>(true);
  const [autoSendEnabled, setAutoSendEnabled] = useState<boolean>(true);

  /* ================= TEMPLATES ================= */

  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState<string>("");
  const [templateMessage, setTemplateMessage] = useState<string>("");

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await getRequest(ROUTES.healthOps.reminderSessionStart, {
        errorMessage: "Unable to load templates.",
      });
      const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
      setTemplates(Array.isArray(list) ? list : []);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async () => {
    if (!templateName || !templateMessage) return;
    setSavingTemplate(true);
    try {
      const res = await postRequest(ROUTES.healthOps.reminderSessionStart, {
        name: templateName,
        message: templateMessage,
        type: "template",
      });
      const created = res?.data ?? res;
      if (created?.id) {
        setTemplates((prev) => [...prev, created]);
      } else {
        await fetchTemplates();
      }
      setTemplateName("");
      setTemplateMessage("");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not save template.");
    } finally {
      setSavingTemplate(false);
    }
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

  const fetchNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const res = await getRequest(ROUTES.healthOps.reminderSessionStart, {
        errorMessage: "Unable to load notification history.",
      });
      const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
      setNotifications(Array.isArray(list) ? list : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const createNotification = async () => {
    if (!title || !message || !recipient) return;
    setSendingNotification(true);
    try {
      const res = await postRequest(ROUTES.healthOps.reminderSessionStart, {
        title,
        message,
        recipient,
        channel,
        priority,
        scheduled_for: scheduleDate || null,
        auto_send: autoSendEnabled,
      });
      const created = res?.data ?? res;
      if (created?.id) {
        setNotifications((prev) => [...prev, created]);
      } else {
        await fetchNotifications();
      }
      setTitle("");
      setMessage("");
      setRecipient("");
      setScheduleDate("");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not send notification.");
    } finally {
      setSendingNotification(false);
    }
  };

  const updateStatus = async (id: string, status: Status) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status } : n))
    );
    try {
      await patchRequest(
        ROUTES.healthOps.reminderSessionStep(id),
        { status }
      );
    } catch {
      // optimistic update already applied
    }
  };

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, status: "Read" } : n))
    );
    try {
      await patchRequest(
        ROUTES.healthOps.reminderSessionDelivery(id),
        { read: true, status: "Read" }
      );
    } catch {
      // optimistic update already applied
    }
  };

  /* ================= ANALYTICS ================= */

  const totalNotifications = notifications.length;
  const deliveredCount = notifications.filter((n) => n.status === "Delivered").length;
  const readCount = notifications.filter((n) => n.read).length;
  const scheduledCount = notifications.filter((n) => n.status === "Scheduled").length;

  /* ================= UI ================= */

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={{ padding: spacing.md }}
    >
      {/* CONFIGURATION */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Notification Engine Configuration
        </Text>

        <KISButton
          title={engineEnabled ? "Disable Engine" : "Enable Engine"}
          onPress={() => setEngineEnabled(!engineEnabled)}
          variant="outline"
        />
        <KISButton
          title={autoSendEnabled ? "Disable Auto Send" : "Enable Auto Send"}
          onPress={() => setAutoSendEnabled(!autoSendEnabled)}
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
  backgroundColor: palette.background,
  padding: spacing.sm,
  borderRadius: 12,
  marginVertical: spacing.xs,
});
