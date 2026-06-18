import React, { useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

const EFFECTIVE_DATE = 'June 1, 2026';
const COMPANY_NAME = 'KIS';
const SUPPORT_EMAIL = 'legal@kisapp.com';
const SUPPORT_URL = 'https://kisapp.com';

type Section = { id: string; title: string; body: string[] };

const SECTIONS: Section[] = [
  {
    id: '1',
    title: '1. Acceptance of Terms',
    body: [
      `Welcome to KIS ("the App," "the Platform," "we," "us," or "our"). KIS is a faith-centered digital community built for believers to connect, grow, serve, and thrive together in the Kingdom of God.`,
      `By downloading, installing, accessing, or using the KIS mobile application or any related services (collectively, the "Services"), you ("User," "you") agree to be bound by these Terms and Conditions ("Terms"), our Privacy Policy, and our Community Standards. If you do not agree to these Terms in their entirety, you must not use the Services.`,
      `These Terms constitute a legally binding agreement between you and ${COMPANY_NAME}. Your continued use of the Platform following any updates to these Terms constitutes your acceptance of the revised Terms.`,
    ],
  },
  {
    id: '2',
    title: '2. About KIS',
    body: [
      `KIS is a faith-based social platform designed to serve the global Christian community. Our mission is to empower believers to connect authentically, share testimonies of God's faithfulness, access spiritually enriching content, support one another through life's seasons, and advance the Kingdom of God through digital community.`,
      `Core features of the Platform include: private and group messaging with end-to-end encryption, community channels and forums, live broadcasting and studio streaming, testimony networks, partner church and ministry tools, health and wellness services, marketplace and commerce tools, educational and devotional content, prayer and support networks, events management, and more.`,
      `KIS is not affiliated with any specific denomination but upholds broadly shared Christian values including love, truth, integrity, compassion, dignity, and service.`,
    ],
  },
  {
    id: '3',
    title: '3. Eligibility',
    body: [
      `By using KIS you represent and warrant that: (a) you are at least 13 years of age; (b) if you are between 13 and 17 years old, you have obtained parental or guardian consent; (c) you have the legal capacity to enter into these Terms; (d) you are not barred from using the Services under the laws of your applicable jurisdiction; and (e) you have not previously been suspended or removed from the Platform for violating our Terms or Community Standards.`,
      `For users under 18, parents or guardians are responsible for supervising their child's use of the Platform and must consent to these Terms on their behalf. KIS offers parental account-linking and recovery features to support this responsibility.`,
      `We reserve the right to refuse access to any person or entity that we believe, at our sole discretion, poses a risk to the safety, wellbeing, or integrity of the Platform or its members.`,
    ],
  },
  {
    id: '4',
    title: '4. Account Registration and Security',
    body: [
      `To access most features of KIS, you must create an account. You agree to provide accurate, current, and complete registration information and to promptly update this information as necessary. You are solely responsible for all activity that occurs under your account.`,
      `You are responsible for maintaining the confidentiality of your login credentials. You must notify us immediately at ${SUPPORT_EMAIL} if you suspect unauthorized access to your account. KIS will not be liable for losses arising from unauthorized use of your account.`,
      `You may not: share your account credentials with any third party; create multiple accounts for abusive purposes; impersonate any person, organization, or ministry; or register an account on behalf of another person without their explicit consent.`,
      `KIS employs end-to-end encryption (E2EE) for private messages where enabled. However, no transmission over the internet or electronic storage is 100% secure. You acknowledge and accept the inherent risks of digital communication.`,
    ],
  },
  {
    id: '5',
    title: '5. Community Standards and Faith-Based Guidelines',
    body: [
      `KIS is a community rooted in Christian values. All users are expected to engage with respect, grace, and love — reflecting the character of Christ in their interactions. Our Community Standards are an extension of these Terms and are incorporated herein by reference.`,
      `You agree not to post, share, broadcast, or otherwise transmit content that: is hateful, abusive, discriminatory, or harassing; promotes violence, self-harm, or illegal activity; exploits, endangers, or sexualizes minors in any way; is sexually explicit, graphic, or obscene; spreads deliberate misinformation or doctrinal content intended to deceive; or is otherwise inconsistent with the dignity and safety of our community.`,
      `KIS is a platform for building up the body of Christ. Constructive theological discussion is welcome; however, inflammatory content intended solely to divide, demean, or destabilize the community is prohibited.`,
      `We reserve the right to remove content, suspend accounts, or take any other action we deem appropriate when Community Standards are violated, without prior notice.`,
    ],
  },
  {
    id: '6',
    title: '6. User-Generated Content',
    body: [
      `KIS allows users to create and share content including text, images, audio, video, live streams, testimonies, polls, events, articles, and more ("User Content"). You retain ownership of the intellectual property rights you hold in your User Content.`,
      `By submitting User Content to the Platform, you grant KIS a worldwide, non-exclusive, royalty-free, sublicensable, transferable license to use, host, store, reproduce, modify, distribute, publish, and display your User Content for the purposes of operating, improving, and promoting the Services. This license terminates when you delete your content or account, subject to content retained in backups or distributed to other users.`,
      `You represent and warrant that: (a) you own or have the necessary rights to the User Content you post; (b) your User Content does not violate any third-party rights including copyright, trademark, privacy, or publicity rights; and (c) your User Content complies with these Terms and applicable law.`,
      `KIS does not endorse any User Content and expressly disclaims all liability in connection with User Content. You are solely responsible for the content you publish.`,
    ],
  },
  {
    id: '7',
    title: '7. Testimony Network',
    body: [
      `The Testimony Network is a sacred space designed for users to share personal accounts of God's faithfulness through trials, healing, redemption, and breakthrough. We take the sensitivity of these stories seriously.`,
      `By sharing a testimony, you grant KIS the right to display it within the Platform for the encouragement of the community. You also consent to other users responding to your testimony with support and reach-out messages. You may control visibility and interaction settings from your profile.`,
      `Testimonies involving sensitive topics (health, addiction, grief, abuse, mental health) must be shared with care and in accordance with our Content Guidelines. KIS reserves the right to remove testimonies that could endanger the sharer or others.`,
      `KIS does not verify the accuracy of testimonies shared. The Platform is not responsible for any reliance placed on user testimonies by other members. Testimonies are personal accounts, not professional advice.`,
      `Users who reach out to others through the Testimony Network must do so with genuine intention to support and encourage. Solicitation, manipulation, or predatory behavior in this context is strictly prohibited and may result in permanent account termination.`,
    ],
  },
  {
    id: '8',
    title: '8. Health and Wellness Services',
    body: [
      `KIS may provide access to health and wellness resources, professional consultations, and secure messaging with health service providers through the Platform's Health Services feature.`,
      `IMPORTANT DISCLAIMER: KIS is not a healthcare provider, and the Platform is not a substitute for professional medical advice, diagnosis, or treatment. Health content on KIS is for informational purposes only. Always consult a qualified healthcare professional regarding any medical condition or treatment.`,
      `Health service providers who offer services through KIS are independent third parties. KIS does not employ them, does not control their practice, and is not responsible for the quality, accuracy, or outcome of any services they provide.`,
      `Secure messaging within the health services module is encrypted and designed with privacy in mind. However, you acknowledge that no digital communication system can guarantee absolute security, and you use these features at your own risk.`,
      `In an emergency, dial your local emergency services number immediately. Do not rely on KIS for emergency medical assistance.`,
    ],
  },
  {
    id: '9',
    title: '9. Marketplace and Commerce',
    body: [
      `KIS offers marketplace features allowing users and ministry partners to create shops, list products and services, and conduct transactions ("Market Services").`,
      `Transactions on the Marketplace are between buyers and sellers directly. KIS may facilitate payment processing but is not a party to any transaction. We make no guarantees about the quality, safety, or legality of items or services listed.`,
      `Sellers are responsible for accurate product descriptions, lawful sale of items, fulfillment of orders, and compliance with applicable consumer protection and tax laws. Buyers are advised to exercise due diligence before making purchases.`,
      `Disputes between buyers and sellers should first be resolved directly between the parties. KIS may, at its discretion, provide a dispute mediation process but is not obligated to do so.`,
      `KIS reserves the right to remove any listing or suspend any seller account that violates our Marketplace Policies, Community Standards, or applicable law.`,
    ],
  },
  {
    id: '10',
    title: '10. Broadcasts and Live Streaming',
    body: [
      `KIS enables users and ministry partners to create and broadcast live and pre-recorded content ("Broadcasts"). Broadcasters are solely responsible for the content they stream or upload.`,
      `You must not broadcast content that infringes third-party copyrights (including unlicensed music, sermons, or footage), violates our Community Standards, or is otherwise prohibited under these Terms.`,
      `KIS reserves the right to terminate any live broadcast at any time without notice if it violates our policies or applicable law. Repeated violations may result in permanent loss of broadcasting privileges.`,
      `KIS may display advertisements alongside Broadcast content. Revenue sharing arrangements, where applicable, are subject to separate agreements with Partner broadcasters.`,
    ],
  },
  {
    id: '11',
    title: '11. Privacy and Data Protection',
    body: [
      `Your privacy is deeply important to us. Our Privacy Policy (available at ${SUPPORT_URL}/privacy) describes how we collect, use, store, and share your personal data. The Privacy Policy is incorporated into these Terms by reference.`,
      `By using KIS, you consent to the collection and use of your information as described in the Privacy Policy. You have rights with respect to your personal data including access, correction, deletion, and portability, subject to applicable data protection laws.`,
      `KIS does not sell your personal data to third parties for advertising. We may share data with service providers necessary for the operation of the Platform, subject to confidentiality obligations.`,
      `Messages marked as end-to-end encrypted are protected in transit and at rest using industry-standard cryptographic protocols. KIS cannot access the content of E2EE messages. Note that messages in channels, communities, or other public-facing features may not be end-to-end encrypted.`,
    ],
  },
  {
    id: '12',
    title: '12. Prohibited Activities',
    body: [
      `You agree that you will not use the Platform to: (a) engage in any illegal activity or facilitate illegal conduct; (b) stalk, harass, bully, intimidate, or threaten any person; (c) transmit spam, chain letters, or unsolicited mass messages; (d) harvest or collect user data without consent; (e) introduce malware, viruses, or other harmful code; (f) attempt to gain unauthorized access to any part of the Platform or its infrastructure; (g) scrape, crawl, or systematically extract data from the Platform without authorization; (h) impersonate KIS staff, moderators, or other users; (i) circumvent security, content moderation, or access restrictions; (j) use the Platform for commercial solicitation without explicit authorization; (k) exploit minors in any manner whatsoever.`,
      `Violations of these prohibitions may result in immediate account suspension, permanent termination, and referral to law enforcement where required by law.`,
    ],
  },
  {
    id: '13',
    title: '13. Intellectual Property',
    body: [
      `KIS and its licensors own all rights, title, and interest in and to the Platform, including its software, design, trademarks, logos, and content created by KIS (excluding User Content). Nothing in these Terms grants you any right to use KIS's intellectual property without our prior written consent.`,
      `The "KIS" name, logo, and all related marks are trademarks of the Company. Unauthorized use is strictly prohibited.`,
      `If you believe that content on the Platform infringes your copyright, please contact us at ${SUPPORT_EMAIL} with a detailed notice. We comply with applicable copyright law and will take appropriate action in response to valid notices.`,
    ],
  },
  {
    id: '14',
    title: '14. Third-Party Services and Links',
    body: [
      `KIS may integrate with or link to third-party services, websites, or content providers. We do not endorse and are not responsible for the content, privacy practices, or terms of any third-party services.`,
      `Your use of third-party services is governed by their respective terms and privacy policies. KIS is not liable for any harm, loss, or damage arising from your use of third-party services.`,
    ],
  },
  {
    id: '15',
    title: '15. Disclaimers and Limitation of Liability',
    body: [
      `THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. KIS DISCLAIMS ALL WARRANTIES INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.`,
      `KIS DOES NOT WARRANT THAT: (a) THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE; (b) DEFECTS WILL BE CORRECTED; (c) THE PLATFORM OR SERVERS ARE FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS; OR (d) ANY CONTENT IS ACCURATE, COMPLETE, OR RELIABLE.`,
      `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, KIS AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND PARTNERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA, LOSS OF PROFITS, OR DAMAGES FOR PERSONAL INJURY ARISING FROM YOUR USE OF THE PLATFORM.`,
      `KIS'S TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR YOUR USE OF THE PLATFORM SHALL NOT EXCEED THE AMOUNT YOU PAID TO KIS IN THE TWELVE MONTHS PRECEDING THE CLAIM, OR $100 USD, WHICHEVER IS GREATER.`,
      `Some jurisdictions do not allow the exclusion of certain warranties or the limitation of liability, so some of the above limitations may not apply to you.`,
    ],
  },
  {
    id: '16',
    title: '16. Indemnification',
    body: [
      `You agree to indemnify, defend, and hold harmless KIS, its affiliates, officers, directors, employees, agents, and licensors from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in connection with: (a) your use of the Platform; (b) your User Content; (c) your violation of these Terms; (d) your violation of any rights of another person or entity; or (e) your violation of any applicable law.`,
    ],
  },
  {
    id: '17',
    title: '17. Termination',
    body: [
      `We may suspend or terminate your account and access to the Platform at any time, for any reason, with or without notice, including if we believe you have violated these Terms or Community Standards.`,
      `You may delete your account at any time through the account settings. Upon deletion, your personal data will be handled in accordance with our Privacy Policy. Some content you have shared publicly may persist in backup systems or in the accounts of users who have received it.`,
      `All provisions of these Terms that by their nature should survive termination shall survive, including intellectual property, disclaimers, indemnification, and limitation of liability.`,
    ],
  },
  {
    id: '18',
    title: '18. Governing Law and Dispute Resolution',
    body: [
      `These Terms shall be governed by and construed in accordance with applicable law. Any disputes arising from or relating to these Terms or the Platform shall first be attempted to be resolved through good-faith negotiation.`,
      `If a dispute cannot be resolved informally, you agree to binding arbitration conducted by a recognized arbitration body, on an individual basis. You waive any right to participate in a class action lawsuit or class-wide arbitration.`,
      `Nothing in this section prevents either party from seeking injunctive or other equitable relief from a court of competent jurisdiction where necessary to prevent irreparable harm.`,
    ],
  },
  {
    id: '19',
    title: '19. Changes to These Terms',
    body: [
      `We reserve the right to modify these Terms at any time. When we make material changes, we will notify you through the Platform, by email, or by other reasonable means. Your continued use of the Platform after the effective date of revised Terms constitutes your acceptance.`,
      `We encourage you to review these Terms periodically. The "Effective Date" at the top of this document reflects the date of the most recent revision.`,
    ],
  },
  {
    id: '20',
    title: '20. Contact Us',
    body: [
      `If you have questions, concerns, or feedback about these Terms, please contact us:`,
      `Email: ${SUPPORT_EMAIL}`,
      `Website: ${SUPPORT_URL}`,
      `We are committed to addressing your concerns in the spirit of care and integrity that defines the KIS community.`,
    ],
  },
];

type Props = {
  navigation?: any;
  route?: any;
  /** When true, shows an "I Agree" CTA at the bottom and calls onAgree when tapped */
  onAgree?: () => void;
  showAgreeButton?: boolean;
};

export default function TermsAndConditionsScreen({ navigation, onAgree, showAgreeButton }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const sectionYRef = useRef<Record<string, number>>({});
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  const s = makeStyles(palette);

  const handleScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 80;
    if (isNearBottom && !hasScrolledToBottom) setHasScrolledToBottom(true);
  };

  const canGoBack = navigation?.canGoBack?.();

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: palette.divider }]}>
        {canGoBack && (
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={12}>
            <KISIcon name="arrow-left" size={22} color={palette.text} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: palette.text }]}>Terms & Conditions</Text>
          <Text style={[s.effectiveDate, { color: palette.subtext }]}>
            Effective {EFFECTIVE_DATE}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[
          s.content,
          { paddingBottom: Math.max(insets.bottom, 24) + (showAgreeButton ? 90 : 0) },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={200}
      >
        {/* Preamble */}
        <View style={[s.preamble, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[s.preambleText, { color: palette.subtext }]}>
            Please read these Terms carefully before using KIS. They govern your use of the
            Platform and form a binding agreement between you and KIS.
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

      {/* Agree CTA */}
      {showAgreeButton && (
        <View
          style={[
            s.cta,
            {
              backgroundColor: palette.bg,
              borderTopColor: palette.divider,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {!hasScrolledToBottom && (
            <Text style={[s.scrollHint, { color: palette.subtext }]}>
              Scroll to read the full Terms before agreeing
            </Text>
          )}
          <Pressable
            onPress={onAgree}
            style={[
              s.agreeBtn,
              { backgroundColor: hasScrolledToBottom ? palette.primary : palette.inputBorder },
            ]}
            disabled={!hasScrolledToBottom}
          >
            <Text
              style={[
                s.agreeBtnText,
                { color: hasScrolledToBottom ? palette.onPrimary : palette.subtext },
              ]}
            >
              I Have Read and Agree
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(palette: any) {
  return StyleSheet.create({
    safe: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn: { padding: 4 },
    title: { fontSize: 18, fontWeight: '800' },
    effectiveDate: { fontSize: 12, marginTop: 2 },
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
    cta: {
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 8,
    },
    scrollHint: { fontSize: 12, textAlign: 'center' },
    agreeBtn: {
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    agreeBtnText: { fontSize: 15, fontWeight: '700' },
  });
}
