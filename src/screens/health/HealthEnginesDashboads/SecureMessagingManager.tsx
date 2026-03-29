import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useColorScheme } from "react-native";
import { HEALTH_THEME_SPACING } from "@/theme/health/spacing";
import { HEALTH_THEME_TYPOGRAPHY } from "@/theme/health/typography";
import { getHealthThemeColors } from "@/theme/health/colors";
import KISButton from "@/constants/KISButton";

/* ================= TYPES ================= */

type Role = "Doctor" | "Nurse" | "Lab" | "Admin";

type Message = {
  id: string;
  sender: Role;
  content: string;
  timestamp: number;
  read: boolean;
  urgent: boolean;
};

type Conversation = {
  id: string;
  patientName: string;
  participants: Role[];
  encrypted: boolean;
  messages: Message[];
};

/* ================= COMPONENT ================= */

export default function SecureMessagingManager() {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === "light" ? "light" : "dark");
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  /* ================= CONFIG ================= */

  const [engineEnabled, setEngineEnabled] = useState(true);
  const [defaultEncryption, setDefaultEncryption] = useState(true);

  /* ================= CONVERSATIONS ================= */

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [newPatientName, setNewPatientName] = useState("");

  const createConversation = () => {
    if (!newPatientName) return;

    const newConversation: Conversation = {
      id: Date.now().toString(),
      patientName: newPatientName,
      participants: ["Doctor", "Nurse"],
      encrypted: defaultEncryption,
      messages: [],
    };

    setConversations((prev) => [...prev, newConversation]);
    setNewPatientName("");
  };

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );

  /* ================= MESSAGING ================= */

  const [messageText, setMessageText] = useState("");
  const [urgentFlag, setUrgentFlag] = useState(false);

  const sendMessage = () => {
    if (!activeConversation || !messageText) return;

    const newMessage: Message = {
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
  };

  const markAsRead = (messageId: string) => {
    if (!activeConversation) return;

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
  };

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

  return (
    <ScrollView style={{ padding: spacing.md }}>

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

        {conversations.map((conv) => (
          <TouchableOpacity
            key={conv.id}
            onPress={() => setActiveConversationId(conv.id)}
            style={[
              itemCard(palette, spacing),
              activeConversationId === conv.id && {
                borderWidth: 2,
                borderColor: palette.primary,
              },
            ]}
          >
            <Text style={{ color: palette.text }}>
              {conv.patientName}
            </Text>
            <Text style={{ color: palette.subtext }}>
              Messages: {conv.messages.length}
            </Text>
            <Text style={{ color: palette.subtext }}>
              {conv.encrypted ? "Encrypted 🔐" : "Not Encrypted"}
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

          {activeConversation.messages.map((msg) => (
            <TouchableOpacity
              key={msg.id}
              onPress={() => markAsRead(msg.id)}
              style={[
                itemCard(palette, spacing),
                msg.urgent && { borderWidth: 2, borderColor: "red" },
              ]}
            >
              <Text style={{ color: palette.text }}>
                {msg.sender}
              </Text>
              <Text style={{ color: palette.text }}>
                {msg.content}
              </Text>
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