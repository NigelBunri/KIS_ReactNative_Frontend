import React from "react";
import {
  Text,
  View,
  Modal,
  useColorScheme,
  TouchableOpacity,
  Linking,
} from "react-native";
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
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
import PaymentBillingManager from "./PaymentBillingManager";
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
      return <VideoConsultationEngine institutionId={institutionId} engineKey={engineKey} />;

    case "Secure Messaging Engine":
      return <SecureMessagingEngine institutionId={institutionId} engineKey={engineKey} />;

    case "E-Prescription Engine":
      return <EPrescriptionEngine institutionId={institutionId} engineKey={engineKey} />;

    case "Lab Order Engine":
      return <LabOrderEngine institutionId={institutionId} engineKey={engineKey} />;

    case "Imaging Order Engine":
      return <ImagingOrderEngine institutionId={institutionId} engineKey={engineKey} />;

    case "Emergency Dispatch Engine":
      return <EmergencyDispatchEngine institutionId={institutionId} engineKey={engineKey} />;

    case "Pharmacy & Fulfillment Engine":
      return <PharmacyManager institutionId={institutionId} engineKey={engineKey} />;

    case "Home Logistics Engine":
      return <HomeLogisticsEngine institutionId={institutionId} engineKey={engineKey} />;

    case "Wellness Program Engine":
      return <WellnessProgramEngine institutionId={institutionId} engineKey={engineKey} />;

    case "EHR / Health Records Engine":
      return <EHRManager institutionId={institutionId} engineKey={engineKey} />;

    case "Notification & Reminder Engine":
      return <NotificationReminderEngine institutionId={institutionId} engineKey={engineKey} />;

    case "Payment & Billing Engine":
      return <PaymentBillingManager institutionId={institutionId} engineKey={engineKey} />;

    default:
      return (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text
            style={{
              color: palette.text,
              ...typography.h3,
              fontWeight: "700",
            }}
          >
            {data.name}
          </Text>
          <Text style={{ color: palette.subtext, ...typography.body }}>
            This engine type is not yet available in this version of the app.
          </Text>
          <TouchableOpacity
            onPress={() =>
              Linking.openURL("mailto:support@kisapp.com")
            }
            style={{
              marginTop: spacing.sm,
              alignSelf: "flex-start",
              backgroundColor: palette.primary + "18",
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: palette.primary + "40",
            }}
            accessibilityLabel="Contact support"
          >
            <Text
              style={{
                color: palette.primary,
                ...typography.body,
                fontWeight: "600",
              }}
            >
              Contact support
            </Text>
          </TouchableOpacity>
          {__DEV__ && (
            <Text
              style={{
                color: palette.subtext,
                fontSize: 11,
                marginTop: spacing.sm,
                opacity: 0.6,
              }}
            >
              [DEV] engine key: {engineKey}
            </Text>
          )}
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
          backgroundColor: palette.bg,
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
              color: palette.subtext,
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

        {/* ENGINE CONTENT — each engine provides its own ScrollView */}
        <View style={{ flex: 1 }}>
          {renderEngine()}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
