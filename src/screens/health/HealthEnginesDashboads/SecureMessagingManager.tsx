import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Alert,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HEALTH_THEME_SPACING } from "@/theme/health/spacing";
import { HEALTH_THEME_TYPOGRAPHY } from "@/theme/health/typography";
import { getHealthThemeColors } from "@/theme/health/colors";
import { useKISTheme } from "@/theme/useTheme";
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

type Props = { institutionId: string; engineKey: string };

export default function SecureMessagingManager({ institutionId, engineKey }: Props) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === "light" ? "light" : "dark");
  const { palette: kisPalette } = useKISTheme();
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  /* ================= CONFIG ================= */

  const [engineEnabled, setEngineEnabled] = useState(true);
  const [engineConfigItemId, setEngineConfigItemId] = useState<string | null>(null);
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

    // NOTE: there is no backend endpoint to list secure-messaging sessions for
    // an institution yet — health-ops/messaging/sessions/start/ only supports
    // POST (creating one conversation session at a time). Conversations
    // created below persist on the server, but won't be re-listed on reload
    // until a list endpoint exists, so we simply start with an empty list
    // instead of calling an endpoint that will always fail.
    setConversations((prev) => prev);

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

      // The backend messages endpoint only supports POST (create). Mark-as-read
      // is signalled via the session step endpoint with a read_message action.
      // Optimistic local update happens first regardless of outcome.
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

      try {
        await patchRequest(
          ROUTES.healthOps.messagingSessionStep(activeConversation.id),
          { action: 'read_message', message_id: messageId },
        );
      } catch {
        // Best-effort; local state already reflects the change
      }
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
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
          onPress={() => { toggleEngine().catch(() => undefined); }}
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
                msg.urgent && { borderWidth: 2, borderColor: kisPalette.danger },
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
  backgroundColor: palette.bg, marginTop: 25,
  padding: spacing.sm,
  borderRadius: 12,
  marginVertical: spacing.xs,
});
