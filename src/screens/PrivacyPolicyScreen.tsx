import React, { useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

const EFFECTIVE_DATE = 'June 1, 2026';
const SUPPORT_EMAIL = 'legal@kisapp.com';
const SUPPORT_URL = 'https://kisapp.com';

type Section = { id: string; title: string; body: string[] };

const SECTIONS: Section[] = [
  {
    id: '1',
    title: '1. Our Commitment to Your Privacy',
    body: [
      `KIS ("the App," "the Platform," "we," "us," or "our") is a faith-centered community platform connecting believers through messaging, calls, church life, health resources, marketplace, civic tools, and more. This Privacy Policy explains what information we collect, how we use it, who we share it with, and the choices and rights you have.`,
      `This Privacy Policy is incorporated by reference into our Terms & Conditions. If you do not agree with this Policy, please do not use the Platform.`,
      `Because KIS brings together sensitive areas of life — faith, family, health, and finances — we hold ourselves to a higher standard of care with your data than a typical social app. We collect only what is needed to provide each feature, and we do not sell your personal data to third parties for advertising.`,
    ],
  },
  {
    id: '2',
    title: '2. Information You Provide to Us',
    body: [
      `Account Information: when you register, we collect information such as your name, email address or phone number, password, and profile details (photo, bio, church or ministry affiliation) you choose to add.`,
      `User Content: messages, testimonies, prayer requests, posts, comments, photos, videos, voice notes, live broadcasts, and documents you create, upload, or share through chat, community channels, the Testimony Network, and other features.`,
      `Marketplace & Giving Information: information related to listings you create, purchases, orders, tithes, or giving contributions you make, including transaction records processed through our payment partners (see Section 8).`,
      `Health Information You Choose to Share: if you use the Health module, information you enter or share with a health service provider through the Platform — such as messages in secure provider chat, appointment details, or symptoms you describe. See Section 7 for important details specific to health data.`,
      `Support Communications: information you provide when you contact us for support, report content, or submit feedback.`,
    ],
  },
  {
    id: '3',
    title: '3. Information We Collect Automatically or With Your Permission',
    body: [
      `Camera & Photo Library: with your permission, KIS accesses your camera and photo library so you can capture and share photos and videos in chat, testimonies, marketplace listings, and profile setup. We only access media you actively choose to select or capture.`,
      `Microphone: with your permission, KIS accesses your microphone for voice notes and for audio during voice and video calls.`,
      `Location: with your permission, certain features — such as sharing your location in a chat, the Family Hub's SOS feature, and health institution discovery — use your device's location. Location access can be granted only while using the app, and you may revoke it at any time in your device settings.`,
      `Contacts: with your permission, KIS can access your device contacts to help you find and invite friends already using KIS. We do not use your contacts for any other purpose, and we do not upload your entire address book without your explicit action.`,
      `Biometric / Device Lock: if you enable Face ID, Touch ID, or a PIN to lock the app, this authentication happens on your device using your operating system's secure enclave. KIS does not receive, transmit, or store your biometric data — we only receive a yes/no confirmation that you unlocked your device.`,
      `Push Notification Data: we use Firebase Cloud Messaging to deliver push notifications (for example, new messages, call alerts, or prayer wall activity). This requires a device token, which is not personally identifying on its own and is used solely to route notifications to your device.`,
      `Device & Usage Information: we automatically collect limited technical information such as device type, operating system version, app version, crash diagnostics, and general usage patterns (for example, which features are opened) to keep the Platform reliable and to improve it.`,
    ],
  },
  {
    id: '4',
    title: "4. Children's Privacy & Family Accounts",
    body: [
      `KIS is intended for general use by individuals 13 years of age and older. Users between 13 and 17 must have parental or guardian consent, as described in our Terms & Conditions.`,
      `Family Hub & Linked Child Profiles: KIS provides Family Hub features, including the ability for a parent or guardian to create a linked profile for a child under 13 within the family structure, and to configure Parental Controls — content tiers (Child, Youth, Adult), screen-time limits, restricted sections (marketplace, calls, health, chat, media), location sharing, and SOS settings.`,
      `Where a child's profile is created and managed by a parent or guardian, the parent or guardian is responsible for reviewing this Privacy Policy and for any information provided about the child. We collect only what is necessary to operate the linked profile and parental controls, and we do not knowingly allow a child under 13 to independently register their own unsupervised account or to interact outside the boundaries set by their parent or guardian.`,
      `If you believe a child has provided us with personal information outside of a supervised Family Hub profile, please contact us at ${SUPPORT_EMAIL} so we can investigate and, where appropriate, delete that information.`,
    ],
  },
  {
    id: '5',
    title: '5. Messaging Privacy & End-to-End Encryption',
    body: [
      `Private one-to-one and group messages sent through KIS are protected using end-to-end encryption (E2EE) where enabled, meaning the content of your messages is encrypted on your device and can only be decrypted by the intended recipient(s). KIS cannot read the content of E2EE messages.`,
      `Content shared in public or semi-public spaces — including community channels, broadcast comments, the Testimony Network, and marketplace listings — is not end-to-end encrypted, since it is designed to be seen by other members. Please be mindful of what you share in these spaces.`,
      `We retain limited metadata necessary to deliver messages and calls (such as timestamps and participant identifiers) even for E2EE conversations, but this metadata does not include message content.`,
    ],
  },
  {
    id: '6',
    title: '6. The Testimony Network — Handle With Care',
    body: [
      `The Testimony Network allows you to share deeply personal stories of faith, healing, and breakthrough. Testimonies you post are visible to the community as you configure your visibility settings, and other members may send you reach-out messages in response.`,
      `Because testimonies often touch on sensitive topics — health, grief, addiction, abuse, or mental health — we encourage you to think carefully about what you share and to use the visibility controls available in your profile. You may edit or remove your testimonies at any time.`,
    ],
  },
  {
    id: '7',
    title: '7. Health Information',
    body: [
      `KIS's Health module lets you discover health institutions and providers and, where offered, communicate with them through secure in-app messaging. KIS is not a healthcare provider and does not control the practices of independent providers who use the Platform, as described in our Terms & Conditions.`,
      `Information you share with a provider through the Health module — such as messages, appointment requests, or symptoms you describe — is transmitted through encrypted, secure messaging designed with privacy in mind. However, providers accessed through KIS are independent third parties, and their own privacy and data-handling practices govern how they use information you share directly with them.`,
      `We limit our own use of health-related information to what is necessary to operate the feature (for example, connecting you with the right provider and delivering messages), and we do not use health information for advertising.`,
    ],
  },
  {
    id: '8',
    title: '8. How We Share Your Information',
    body: [
      `We do not sell your personal data to third parties for advertising purposes.`,
      `We share information only in the following circumstances: (a) with other users, to the extent required by the features you use (for example, your profile is visible to people you chat with, and public posts are visible per your settings); (b) with service providers who help us operate the Platform, such as cloud hosting, push notification delivery (Firebase Cloud Messaging), and payment processing (for example, Flutterwave, for marketplace purchases and giving); (c) with independent health or ministry partners you choose to engage with through the Platform; (d) to comply with a legal obligation, enforce our Terms, or protect the safety of our community; or (e) in connection with a merger, acquisition, or sale of assets, subject to the protections of this Policy.`,
      `Our service providers are contractually required to protect your information and to use it only for the purposes we've engaged them for.`,
    ],
  },
  {
    id: '9',
    title: '9. Data Retention',
    body: [
      `We retain personal data for as long as your account is active and as needed to provide the Services. When you delete your account, we delete or anonymize your personal data within a reasonable period, except where retention is required to comply with legal obligations, resolve disputes, prevent fraud, or enforce our agreements.`,
      `Content you have shared publicly, or sent to other users, may persist in the accounts of recipients or in backup systems for a period of time after deletion, as described in our Terms & Conditions.`,
    ],
  },
  {
    id: '10',
    title: '10. Your Privacy Rights & Choices',
    body: [
      `You can manage many privacy choices directly within the app, under Settings → Privacy & Compliance, including: toggling Analytics and Personalization preferences; downloading a copy of your data ("Download My Data"); permanently deleting your account and associated data ("Delete All My Data"); clearing locally cached data; and managing your logged-in devices and sessions.`,
      `Depending on your location, you may have additional rights under applicable data protection law, including the right to access, correct, delete, restrict, or port your personal data, and the right to object to certain processing. To exercise these rights, use the in-app tools described above or contact us at ${SUPPORT_EMAIL}.`,
      `You can control camera, microphone, location, contacts, and notification permissions at any time through your device's operating system settings.`,
    ],
  },
  {
    id: '11',
    title: '11. Data Security',
    body: [
      `We use technical and organizational safeguards — including encryption of private messages, secure transmission protocols, and access controls — designed to protect your information from unauthorized access, alteration, or loss.`,
      `No method of electronic storage or transmission is completely secure. While we work hard to protect your data, we cannot guarantee absolute security, and you share information with us at your own risk.`,
    ],
  },
  {
    id: '12',
    title: '12. International Data Transfers',
    body: [
      `KIS serves a global community, and your information may be processed or stored in countries other than your own, including countries whose data protection laws may differ from those in your jurisdiction. Where we transfer personal data internationally, we take steps to ensure it remains protected consistent with this Policy.`,
    ],
  },
  {
    id: '13',
    title: '13. Third-Party Services',
    body: [
      `KIS integrates with a limited set of third-party services necessary to operate the Platform, including Firebase Cloud Messaging (push notifications) and payment processors such as Flutterwave (marketplace transactions and giving). These providers process data under their own privacy policies in addition to the safeguards we require of them.`,
      `Independent health providers, ministry partners, and marketplace sellers you interact with through KIS operate under their own privacy practices for information you share with them directly. We encourage you to review their policies where available.`,
    ],
  },
  {
    id: '14',
    title: '14. Changes to This Privacy Policy',
    body: [
      `We may update this Privacy Policy from time to time. When we make material changes, we will notify you through the Platform, by email, or by other reasonable means. The "Effective Date" at the top of this document reflects the date of the most recent revision. Your continued use of KIS after changes take effect constitutes acceptance of the revised Policy.`,
    ],
  },
  {
    id: '15',
    title: '15. Contact Us',
    body: [
      `If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us:`,
      `Email: ${SUPPORT_EMAIL}`,
      `Website: ${SUPPORT_URL}`,
      `We are committed to handling your information with the same care and integrity that defines the KIS community.`,
    ],
  },
];

type Props = {
  navigation?: any;
  route?: any;
};

export default function PrivacyPolicyScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const scrollRef = useRef<ScrollView>(null);
  const sectionYRef = useRef<Record<string, number>>({});
  const [, setHasScrolledToBottom] = useState(false);

  const s = makeStyles(palette);

  const handleScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 80;
    if (isNearBottom) setHasScrolledToBottom(true);
  };

  const canGoBack = navigation?.canGoBack?.();

  return (
    <View style={[s.safe, { backgroundColor: palette.bg }]}>
      <ScreenHeader
        title="Privacy Policy"
        subtitle={`Effective ${EFFECTIVE_DATE}`}
        onBack={canGoBack ? () => navigation.goBack() : undefined}
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 24) }]}
        onScroll={handleScroll}
        scrollEventThrottle={200}
      >
        {/* Preamble */}
        <View style={[s.preamble, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[s.preambleText, { color: palette.subtext }]}>
            This Privacy Policy explains what information KIS collects, how we use and share it,
            and the choices and rights available to you — including for the Testimony Network,
            Health module, and Family Hub.
          </Text>
        </View>

        {/* Table of Contents */}
        <View style={[s.tocCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[s.tocTitle, { color: palette.text }]}>Contents</Text>
          {SECTIONS.map(sec => (
            <Pressable
              key={sec.id}
              onPress={() => {
                const y = sectionYRef.current[sec.id] ?? 0;
                scrollRef.current?.scrollTo({ y, animated: true });
              }}
              style={s.tocItem}
            >
              <Text style={[s.tocText, { color: palette.primary }]}>{sec.title}</Text>
            </Pressable>
          ))}
        </View>

        {/* Sections */}
        {SECTIONS.map(sec => (
          <View
            key={sec.id}
            style={s.section}
            onLayout={e => { sectionYRef.current[sec.id] = e.nativeEvent.layout.y; }}
          >
            <Text style={[s.sectionTitle, { color: palette.text }]}>{sec.title}</Text>
            {sec.body.map((para, i) => (
              <Text key={i} style={[s.para, { color: palette.subtext }]}>
                {para}
              </Text>
            ))}
          </View>
        ))}

        {/* Footer */}
        <View style={[s.footer, { borderTopColor: palette.divider }]}>
          <Text style={[s.footerText, { color: palette.subtext }]}>
            © 2026 KIS. All rights reserved.
          </Text>
          <Pressable
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
            hitSlop={8}
          >
            <Text style={[s.footerLink, { color: palette.primary }]}>{SUPPORT_EMAIL}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(palette: any) {
  return StyleSheet.create({
    safe: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
    preamble: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
    },
    preambleText: { fontSize: 13, lineHeight: 20 },
    tocCard: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      gap: 6,
    },
    tocTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
    tocItem: { paddingVertical: 2 },
    tocText: { fontSize: 13 },
    section: { gap: 8 },
    sectionTitle: { fontSize: 15, fontWeight: '700', lineHeight: 22 },
    para: { fontSize: 13, lineHeight: 21 },
    footer: {
      marginTop: 8,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      gap: 6,
    },
    footerText: { fontSize: 12 },
    footerLink: { fontSize: 12, fontWeight: '600' },
  });
}
