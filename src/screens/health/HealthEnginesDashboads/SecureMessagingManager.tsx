import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
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

type Role = "Doctor" | "Nurse" | "Lab" | "Admin";

type Message = {
  id: string;
  sender: Role | string;
  content: string;
  timestamp: number;
  read: boolean;
  urgent: boolean;
};

type Conversation = {
  id: string;
  patientName: string;
  participants: (Role | string)[];
  encrypted: boolean;
  messages: Message[];
};

/* ================= HELPERS ================= */

const normalizeConversation = (raw: any): Conversation => ({
  id: String(raw.id ?? ""),
  patientName:
    raw.patient_name ||
    raw.patientName ||
    raw.patient?.name ||
    raw.patient?.full_name ||
    "Unknown",
  participants: raw.participants ?? ["Doctor", "Nurse"],
  encrypted: raw.encrypted ?? raw.is_encrypted ?? true,
  messages: Array.isArray(raw.messages)
    ? raw.messages.map(normalizeMessage)
    : [],
});

const normalizeMessage = (raw: any): Message => ({
  id: String(raw.id ?? ""),
  sender: raw.sender ?? raw.sender_role ?? "Doctor",
  content: raw.content ?? raw.text ?? raw.body ?? "",
  timestamp:
    typeof raw.timestamp === "number"
      ? raw.timestamp
      : raw.created_at
      ? new Date(raw.created_at).getTime()
      : Date.now(),
  read: raw.read ?? raw.is_read ?? false,
  urgent: raw.urgent ?? raw.is_urgent ?? false,
});

/* ================= COMPONENT ================= */

export default function SecureMessagingManager() {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === "light" ? "light" : "dark");
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  /* ================= CONFIG ================= */

  const [engineEnabled, setEngineEnabled] = useState(true);
  const [defaultEncryption, setDefaultEncryption] = useState(true);

  /* ================= REMOTE DATA ================= */

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ================= FETCH ================= */

  const fetchConversations = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const res2 = await getRequest(
      ROUTES.healthOps.messagingSessionStart.replace("/start/", "/"),
      {}
    );

    if (res2.success) {
      const data = res2.data;
      const list: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
        ? data.results
        : [];
      setConversations(list.map(normalizeConversation));
    } else {
      setError(res2.message || "Failed to load conversations.");
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  const fetchMessages = useCallback(async (sessionId: string) => {
    const res = await getRequest(ROUTES.healthOps.messagingSessionMessages(sessionId));
    if (res.success) {
      const raw = res.data;
      const list: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.results)
        ? raw.results
        : [];
      setConversations((prev) =>
        prev.map((c) =>
          c.id === sessionId
            ? { ...c, messages: list.map(normalizeMessage) }
            : c
        )
      );
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  /* ================= SELECT CONVERSATION ================= */

  const selectConversation = useCallback(
    (id: string) => {
      setActiveConversationId(id);
      fetchMessages(id);
    },
    [fetchMessages]
  );

  /* ================= CREATE CONVERSATION ================= */

  const [newPatientName, setNewPatientName] = useState("");

  const createConversation = useCallback(async () => {
    if (!newPatientName) return;

    const res = await postRequest(ROUTES.healthOps.messagingSessionStart, {
      patient_name: newPatientName,
      encrypted: defaultEncryption,
    });

    if (res.success && res.data) {
      const newConv = normalizeConversation(res.data);
      setConversations((prev) => [...prev, newConv]);
    } else {
      // Optimistic fallback
      const newConv: Conversation = {
        id: Date.now().toString(),
        patientName: newPatientName,
        participants: ["Doctor", "Nurse"],
        encrypted: defaultEncryption,
        messages: [],
      };
      setConversations((prev) => [...prev, newConv]);
    }

    setNewPatientName("");
  }, [newPatientName, defaultEncryption]);

  /* ================= MESSAGING ================= */

  const [messageText, setMessageText] = useState("");
  const [urgentFlag, setUrgentFlag] = useState(false);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );

  const sendMessage = useCallback(async () => {
    if (!activeConversation || !messageText) return;

    const res = await postRequest(
      ROUTES.healthOps.messagingSessionMessages(activeConversation.id),
      {
        content: messageText,
        urgent: urgentFlag,
        sender: "Doctor",
      }
    );

    const newMessage: Message =
      res.success && res.data
        ? normalizeMessage(res.data)
        : {
            id: Date.now().toString(),
            sender: "Doctor",
            content: messageText,
            timestamp: Date.now(),
            read: false,
            urgent: urgentFlag,
          };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? { ...c, messages: [...c.messages, newMessage] }
          : c
      )
    );

    setMessageText("");
    setUrgentFlag(false);
  }, [activeConversation, messageText, urgentFlag]);

  const markAsRead = useCallback(
    async (messageId: string) => {
      if (!activeConversation) return;

      await patchRequest(
        `${ROUTES.healthOps.messagingSessionMessages(activeConversation.id)}${messageId}/`,
        { read: true }
      );

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConversation.id) return c;
          return {
            ...c,
            messages: c.messages.map((m) =>
              m.id === messageId ? { ...m, read: true } : m
            ),
          };
        })
      );
    },
    [activeConversation]
  );

  /* ================= ANALYTICS ================= */

  const totalConversations = conversations.length;
  const totalMessages = conversations.reduce(
    (sum, c) => sum + c.messages.length,
    0
  );
  const unreadMessages = conversations.reduce(
    (sum, c) => sum + c.messages.filter((m) => !m.read).length,
    0
  );
  const urgentMessages = conversations.reduce(
    (sum, c) => sum + c.messages.filter((m) => m.urgent).length,
    0
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
        <KISButton title="Retry" onPress={() => fetchConversations()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ padding: spacing.md }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchConversations(true)}
        />
      }
    >

      {/* ===== CONFIG ===== */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Messaging Configuration
        </Text>

        <KISButton
          title={engineEnabled ? "Disable Messaging" : "Enable Messaging"}
          onPress={() => setEngineEnabled(!engineEnabled)}
          variant="outline"
        />

        <KISButton
          title={
            defaultEncryption
              ? "Disable Default Encryption"
              : "Enable Default Encryption"
          }
          onPress={() => setDefaultEncryption(!defaultEncryption)}
          variant="outline"
        />
      </View>

      {/* ===== CREATE CONVERSATION ===== */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Start New Conversation
        </Text>

        <TextInput
          placeholder="Patient Name"
          value={newPatientName}
          onChangeText={setNewPatientName}
          style={input(palette, spacing)}
        />

        <KISButton title="Create Conversation" onPress={createConversation} />
      </View>

      {/* ===== CONVERSATION LIST ===== */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Conversations
        </Text>

        {conversations.length === 0 && (
          <Text style={{ color: palette.subtext }}>No conversations yet.</Text>
        )}

        {conversations.map((conv) => (
          <TouchableOpacity
            key={conv.id}
            onPress={() => selectConversation(conv.id)}
            style={[
              itemCard(palette, spacing),
              activeConversationId === conv.id && {
                borderWidth: 2,
                borderColor: palette.primary,
              },
            ]}
          >
            <Text style={{ color: palette.text }}>{conv.patientName}</Text>
            <Text style={{ color: palette.subtext }}>
              Messages: {conv.messages.length}
            </Text>
            <Text style={{ color: palette.subtext }}>
              {conv.encrypted ? "Encrypted" : "Not Encrypted"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ===== ACTIVE CHAT ===== */}
      {activeConversation && (
        <View style={card(palette, spacing)}>
          <Text style={{ ...typography.h2, color: palette.text }}>
            Chat - {activeConversation.patientName}
          </Text>

          {activeConversation.messages.length === 0 && (
            <Text style={{ color: palette.subtext }}>No messages yet.</Text>
          )}

          {activeConversation.messages.map((msg) => (
            <TouchableOpacity
              key={msg.id}
              onPress={() => markAsRead(msg.id)}
              style={[
                itemCard(palette, spacing),
                msg.urgent && { borderWidth: 2, borderColor: "red" },
              ]}
            >
              <Text style={{ color: palette.text }}>{msg.sender}</Text>
              <Text style={{ color: palette.text }}>{msg.content}</Text>
              <Text style={{ color: palette.subtext }}>
                {new Date(msg.timestamp).toLocaleString()}
              </Text>
              <Text style={{ color: palette.subtext }}>
                {msg.read ? "Read" : "Unread"}
              </Text>
            </TouchableOpacity>
          ))}

          <TextInput
            placeholder="Type message..."
            value={messageText}
            onChangeText={setMessageText}
            style={input(palette, spacing)}
          />

          <KISButton
            title={urgentFlag ? "Urgent ON" : "Mark as Urgent"}
            onPress={() => setUrgentFlag(!urgentFlag)}
            variant="outline"
          />

          <KISButton title="Send Message" onPress={sendMessage} />
        </View>
      )}

      {/* ===== ANALYTICS ===== */}
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          Messaging Analytics
        </Text>

        <Text style={{ color: palette.text }}>
          Total Conversations: {totalConversations}
        </Text>
        <Text style={{ color: palette.text }}>
          Total Messages: {totalMessages}
        </Text>
        <Text style={{ color: palette.text }}>
          Unread Messages: {unreadMessages}
        </Text>
        <Text style={{ color: palette.text }}>
          Urgent Messages: {urgentMessages}
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
