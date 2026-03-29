// src/screens/WelcomeScreen.tsx
import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Linking,
  useWindowDimensions,
  ScrollView,
  Platform,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useKISTheme } from '../theme/useTheme';
import KISButton from '../constants/KISButton';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import KISText from '@/components/common/KISText';

// theme-aware hero illustrations (light/dark)
import avatarsLight from '../assets/welcom_light.png';
import avatarsDark from '../assets/welcom_dark.png';

// NEW: reuse your server-side auth check
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
// NEW: consume app-wide auth context (optional but nice to keep in sync)
import { useAuth } from '../../App';
import { getAccessToken } from '@/security/authStorage';

const PRIVACY_URL = 'https://christiancommunit.netlify.app';
const AUTH_429_BACKOFF_MS = 2 * 60 * 1000;
let welcomeAuthCheckBlockedUntil = 0;

Ionicons.loadFont?.();

export default function WelcomeScreen() {
  const navigation = useNavigation<any>();
  const { palette, tone } = useKISTheme();
  const { setAuth, setPhone } = useAuth(); // keep global auth in sync if we auto-redirect
  const fade = useRef(new Animated.Value(0)).current;
  const loginCheckInFlightRef = useRef(false);
  const lastLoginCheckAtRef = useRef(0);
  const { width, height } = useWindowDimensions();

  const heroSource = tone === 'dark' ? avatarsDark : avatarsLight;

  // fade animation on theme switch
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [tone, fade]);

  // Adjust hero image size scaling here:
  // 0.75 = scale factor (higher = bigger), 200 = minimum, 520 = maximum.
  const HERO_SCALE = 0.75;   // increase or decrease to resize globally
  const HERO_MIN = 200;      // minimum displayed size
  const HERO_MAX = 520;      // maximum displayed size

  const heroSize = Math.max(HERO_MIN, Math.min(HERO_MAX, Math.round(width * HERO_SCALE)));
  const heroOffset = Math.max(12, Math.round((width * 0.05)));
  const sparkleScale = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleScale, {
          toValue: 1.05,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleScale, {
          toValue: 0.95,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [sparkleScale]);
  const gradientColors = [palette.card, palette.card];
  const cardBorderWidth = tone === 'dark' ? 0 : StyleSheet.hairlineWidth;
  const cardBorderColor = tone === 'dark' ? 'transparent' : palette.border ?? 'rgba(255,255,255,0.35)';

  const highlightFeatures = [
    {
      title: 'Broadcast in any format',
      subtitle: 'Short clips, lessons, and studio streams blend into one feed.',
      icon: 'radio-outline',
    },
    {
      title: 'Market studios',
      subtitle: 'Create shops, manage products, and showcase highlights.',
      icon: 'storefront-outline',
    },
    {
      title: 'Privacy-first profiles',
      subtitle: 'Choose who sees your photos, experiences, articles, and media.',
      icon: 'shield-checkmark-outline',
    },
  ];

  const quickTags = ['Live Worship', 'Partner Communities', 'Partners', 'Market Pro', 'Broadcast Tools'];
  const statsData = [
    { label: 'Live Studios', value: '180+' },
    { label: 'Partner Cities', value: '52' },
    { label: 'Communities', value: '78' },
  ];

  const openExternal = useCallback(() => {
    Linking.openURL(PRIVACY_URL).catch(() => {});
  }, []);

  // NEW: check if logged in and redirect if so
  const checkAndRedirectIfLoggedIn = useCallback(async () => {
    const now = Date.now();
    if (now < welcomeAuthCheckBlockedUntil) return;
    if (loginCheckInFlightRef.current) return;
    if (now - lastLoginCheckAtRef.current < 15000) return;
    loginCheckInFlightRef.current = true;
    lastLoginCheckAtRef.current = now;
    try {
      const token = await getAccessToken();
      const storedPhone = await AsyncStorage.getItem('user_phone');
      if (storedPhone) setPhone?.(storedPhone);

      if (!token) return; // not logged in locally

      const qs = storedPhone ? `?phone=${encodeURIComponent(storedPhone)}` : '';
      const res = await getRequest(`${ROUTES.auth.checkLogin}${qs}`, {
        errorMessage: 'Status check failed.',
        cacheType: 'AUTH_CACHE',
        forceNetwork: true,
      });
      if (!res?.success) {
        if (Number(res?.status) === 429) {
          welcomeAuthCheckBlockedUntil = Date.now() + AUTH_429_BACKOFF_MS;
          setAuth?.(true);
          return;
        }
        setAuth?.(false);
        return;
      }

      const u = res?.data?.user ?? res?.data ?? {};
      const active = res?.success && (u.is_active || u.status === 'active');

      if (active) {
        setAuth?.(true); // App.tsx will switch navigator branch to MainTabs
      } else {
        setAuth?.(false);
      }
    } catch {
      // swallow — stay on Welcome if anything fails
      setAuth?.(false);
    } finally {
      loginCheckInFlightRef.current = false;
    }
  }, [setAuth, setPhone]);

  // Run once on mount
  useEffect(() => {
    checkAndRedirectIfLoggedIn();
  }, [checkAndRedirectIfLoggedIn]);

  // Also run whenever the screen regains focus (e.g., after logout/login elsewhere)
  useFocusEffect(
    useCallback(() => {
      checkAndRedirectIfLoggedIn();
    }, [checkAndRedirectIfLoggedIn])
  );

  return (
    <LinearGradient colors={gradientColors} style={styles.gradientBackground}>
      <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: 0, paddingVertical: 0, minHeight: height },
          ]}
          keyboardShouldPersistTaps="handled"
          bounces
        >
          <View style={styles.backdrop}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: palette.card,
                  width: '100%',
                  maxWidth: 720,
                  alignSelf: 'center',
                  borderWidth: cardBorderWidth,
                  borderColor: cardBorderColor,
                },
              ]}
            >
              <View style={styles.bubbleOverlay} pointerEvents="none">
                {[1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.bubble,
                      styles[`bubble${i}` as 'bubble1' | 'bubble2' | 'bubble3'] as ViewStyle,
                    ]}
                  />
                ))}
              </View>
              <View style={styles.heroWrapper}>
                <Animated.Image
                  source={heroSource}
                  resizeMode="contain"
                  style={[
                    styles.hero,
                    {
                      width: heroSize,
                      height: heroSize,
                      opacity: fade,
                      backgroundColor: tone === 'dark' ? '#0F0D14' : '#FFFFFF',
                      transform: [{ scale: sparkleScale }],
                    },
                  ]}
                />
                <LinearGradient
                  colors={['rgba(255,138,51,0.25)', 'transparent']}
                  style={[
                    styles.heroGlow,
                    { top: heroOffset, right: heroOffset, width: heroSize, height: heroSize },
                  ]}
                />
              </View>

            <KISText preset="h1" color={palette.text} style={styles.title}>
              Welcome to KIS
            </KISText>

            <KISText preset="body" color={palette.subtext} style={styles.subtitle}>
              A space for believers to connect, grow, learn, and support one another.
              Built for today’s world — rooted in faith, guided by purpose, and strengthened in community.
            </KISText>

            <View style={styles.statsRow}>
              {statsData.map((item) => (
                <View key={item.label} style={styles.statCard}>
                  <KISText preset="helper" color={palette.subtext} style={styles.statLabel}>
                    {item.label}
                  </KISText>
                  <KISText preset="h3" color={palette.text} style={styles.statValue}>
                    {item.value}
                  </KISText>
                </View>
              ))}
            </View>

            <View style={styles.tagRow}>
              {quickTags.map((tag) => (
                <View key={tag} style={[styles.tag, { borderColor: palette.border }]}>
                  <KISText preset="helper" color={palette.text} style={styles.tagText}>
                    {tag}
                  </KISText>
                </View>
              ))}
            </View>

            <View style={styles.featureGrid}>
              {highlightFeatures.map((item) => (
                <LinearGradient
                  key={item.title}
                  colors={
                    tone === 'dark'
                      ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']
                      : ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.2)']
                  }
                  style={styles.featureCard}
                >
                  <Ionicons
                    name={item.icon}
                    size={28}
                    color={tone === 'dark' ? '#FFCC57' : '#F97316'}
                  />
                  <KISText preset="title" color={palette.text} style={styles.featureTitle}>
                    {item.title}
                  </KISText>
                  <KISText preset="label" color={palette.subtext} style={styles.featureSubtitle}>
                    {item.subtitle}
                  </KISText>
                </LinearGradient>
              ))}
            </View>

            <View style={styles.buttons}>
              <KISButton
                title="Create Account"
                onPress={() => navigation.navigate('Register')}
                style={{ width: '100%' }}
              />
              <KISButton
                title="Log In"
                variant="secondary"
                onPress={() => navigation.navigate('Login')}
                style={{ marginTop: 12, width: '100%' }}
              />
            </View>

            <KISText preset="helper" color={palette.subtext} style={styles.legal}>
              KIS | 2026 ·{' '}
              <KISText preset="helper" color="#FF8A33" style={styles.link} onPress={openExternal}>
                Privacy
              </KISText>
            </KISText>
          </View>
        </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBackground: { flex: 1, justifyContent: 'center' },
  safe: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  backdrop: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  card: {
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    marginBottom: 0,
    ...Platform.select({
      ios: { shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } },
      android: { elevation: 0 },
    }),
  },
  heroWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  hero: { marginBottom: 12, borderRadius: 20, overflow: 'hidden' },
  heroGlow: {
    position: 'absolute',
    borderRadius: 220,
    opacity: 0.7,
  },
  bubbleOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    width: 90,
    height: 90,
  },
  bubble1: { top: -30, left: -60, opacity: 0.36 },
  bubble2: { bottom: -35, right: -65, opacity: 0.25 },
  bubble3: { top: -5, right: -10, opacity: 0.2 },
  title: { fontSize: 32, fontWeight: '800', textAlign: 'center' },
  subtitle: { marginTop: 12, fontSize: 15, lineHeight: 24, textAlign: 'center', maxWidth: 520 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 18,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 2,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  tagText: { fontSize: 12, letterSpacing: 0.2 },
  featureGrid: {
    width: '100%',
    marginTop: 24,
  },
  featureCard: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  featureTitle: { fontSize: 16, fontWeight: '700' },
  featureSubtitle: { fontSize: 13, lineHeight: 18 },
  buttons: { width: '100%', marginTop: 18 },
  legal: { textAlign: 'center', marginTop: 20, fontSize: 12 },
  link: { fontWeight: '700' },
});
