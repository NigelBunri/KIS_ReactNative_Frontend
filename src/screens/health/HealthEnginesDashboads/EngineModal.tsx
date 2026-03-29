import React from "react";
import {
  Text,
  View,
  Modal,
  useColorScheme,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { HEALTH_THEME_TYPOGRAPHY } from "@/theme/health/typography";
import { HEALTH_THEME_SPACING } from "@/theme/health/spacing";
import { getHealthThemeColors } from "@/theme/health/colors";

/* ===========================
   ENGINE IMPORTS
=========================== */
import AdmissionBedManager from "./AdmissionBedManager";
import AppointmentEngine from "./AppointmentManager";
import VideoConsultationEngine from "./VideoConsultationManager";
import SecureMessagingEngine from "./SecureMessagingManager";
import EPrescriptionEngine from "./EPrescriptionManager";
import LabOrderEngine from "./LabOrderManager";
import ImagingOrderEngine from "./ImagingOrderManager";
import EmergencyDispatchEngine from "./EmergencyDispatchManager";
import HomeLogisticsEngine from "./HomeLogisticsManager";
import WellnessProgramEngine from "./WellnessProgramManager";
import NotificationReminderEngine from "./NotificationReminderManager";
import PharmacyManager from "./PharmacyManager";
import EHRManager from "./EHRManager";
import { KISIcon } from "@/constants/kisIcons";
import { normalizeEngineKey } from "@/services/healthOpsEngineManagerService";

/* ===========================
   TYPES
=========================== */

type EngineData = {
  id: string;
  name: string;
  description: string;
  system_flag: boolean;
};

type Props = {
  onClose: () => void;
  data?: EngineData | null;
  visible: boolean;
  institutionId: string;
};

/* ===========================
   COMPONENT
=========================== */

export default function EngineModal({ data, onClose, visible, institutionId }: Props) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === "light" ? "light" : "dark");
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  if (!data) return null;

  /* ===========================
     ENGINE ROUTER
  =========================== */

 const renderEngine = () => {
  const engineKey = normalizeEngineKey(data.name);
  switch (data.name) {
    case "Admission & Bed Management Engine":
      return <AdmissionBedManager institutionId={institutionId} engineKey={engineKey} />;

    case "Appointment Engine":
      return <AppointmentEngine institutionId={institutionId} engineKey={engineKey} />;

    case "Video Consultation Engine":
      return <VideoConsultationEngine />;

    case "Secure Messaging Engine":
      return <SecureMessagingEngine />;

    case "E-Prescription Engine":
      return <EPrescriptionEngine institutionId={institutionId} engineKey={engineKey} />;

    case "Lab Order Engine":
      return <LabOrderEngine institutionId={institutionId} engineKey={engineKey} />;

    case "Imaging Order Engine":
      return <ImagingOrderEngine institutionId={institutionId} engineKey={engineKey} />;

    case "Emergency Dispatch Engine":
      return <EmergencyDispatchEngine />;

    case "Pharmacy & Fulfillment Engine":
      return <PharmacyManager institutionId={institutionId} engineKey={engineKey} />;

    case "Home Logistics Engine":
      return <HomeLogisticsEngine />;

    case "Wellness Program Engine":
      return <WellnessProgramEngine />;

    case "EHR / Health Records Engine":
      return <EHRManager />;

    case "Notification & Reminder Engine":
      return <NotificationReminderEngine />;

    default:
      return (
        <View style={{ padding: spacing.lg }}>
          <Text style={{ color: palette.text, ...typography.body }}>
            Management panel not implemented.
          </Text>
        </View>
      );
  }
};

  /* ===========================
     UI
  =========================== */

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: palette.background,
        }}
      >
        {/* HEADER */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderColor: palette.divider,
          }}
        >
          {/* Top Row */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: palette.text,
                ...typography.h2,
                flex: 1,
                marginRight: spacing.md,
              }}
              numberOfLines={1}
            >
              {data.name}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 12,
                padding: spacing.xs,
                backgroundColor: palette.card,
              }}
              accessibilityLabel="Close services page"
            >
              <KISIcon name="close" size={18} color={palette.text} />
            </TouchableOpacity>
          </View>

          {/* Description */}
          <Text
            style={{
              marginTop: spacing.sm,
              color: palette.textSecondary,
              ...typography.body,
            }}
          >
            {data.description}
          </Text>

          {/* System Badge */}
          {data.system_flag && (
            <View
              style={{
                marginTop: spacing.sm,
                alignSelf: "flex-start",
                backgroundColor: palette.primary + "20",
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  color: palette.primary,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                SYSTEM ENGINE
              </Text>
            </View>
          )}
        </View>

        {/* ENGINE CONTENT */}
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.xl * 2,
          }}
          showsVerticalScrollIndicator={false}
        >
          {renderEngine()}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
