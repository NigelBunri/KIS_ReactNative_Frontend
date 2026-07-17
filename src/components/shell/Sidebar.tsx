// src/components/shell/Sidebar.tsx
//
// Permanent left navigation rail for the tablet/desktop shell — replaces the
// bottom AnimatedKISTabBar when useResponsiveLayout().shellMode !== 'phone'.
// Visual language (gold gradient pill on the active item, press-scale
// feedback) intentionally mirrors AnimatedKISTabBar in
// src/navigation/AppNavigator.tsx so the tablet nav reads as the same
// product, not a different skin.
import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { KIS_ROYAL_GRADIENTS } from '@/theme/constants';
import { useThemeMode } from '@/theme/themeModeContext';
import { useAuth } from '../../../App';

export type SidebarNavKey =
  | 'Messages'
  | 'Bible'
  | 'Broadcast'
  | 'Partners'
  | 'Communities'
  | 'Marketplace'
  | 'Events'
  | 'Settings';

export const SIDEBAR_EXPANDED_WIDTH = 300;
export const SIDEBAR_COLLAPSED_WIDTH = 88;

const NAV_ITEMS: { key: SidebarNavKey; label: string; icon: KISIconName }[] = [
  { key: 'Messages', label: 'Messages', icon: 'chat' },
  { key: 'Bible', label: 'Bible', icon: 'book' },
  { key: 'Broadcast', label: 'Broadcast', icon: 'megaphone' },
  { key: 'Partners', label: 'Partners', icon: 'people' },
  { key: 'Communities', label: 'Communities', icon: 'group' },
  { key: 'Marketplace', label: 'Marketplace', icon: 'storefront' },
  { key: 'Events', label: 'Events', icon: 'calendar' },
  { key: 'Settings', label: 'Settings', icon: 'settings' },
];

function SidebarItem({
  label,
  icon,
  active,
  collapsed,
  badge,
  onPress,
}: {
  label: string;
  icon: KISIconName;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const { palette, tone } = useKISTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  };

  const gradientColors = tone === 'dark' ? KIS_ROYAL_GRADIENTS.goldDark : KIS_ROYAL_GRADIENTS.goldLight;
  const iconColor = active ? (tone === 'dark' ? palette.royalInk : palette.ivory) : palette.subtext;
  const textColor = active ? palette.goldReadable : palette.text;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        style={[styles.item, collapsed && styles.itemCollapsed]}
      >
        {active ? (
          <LinearGradient
            colors={gradientColors as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.itemIconWrap, collapsed && styles.itemIconWrapCollapsed]}
          >
            <KISIcon name={icon} size={20} color={iconColor} />
          </LinearGradient>
        ) : (
          <View style={[styles.itemIconWrap, collapsed && styles.itemIconWrapCollapsed]}>
            <KISIcon name={icon} size={20} color={iconColor} />
          </View>
        )}
        {!collapsed ? (
          <Text style={[styles.itemLabel, { color: textColor, fontWeight: active ? '800' : '600' }]} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
        {badge && badge > 0 ? (
          <View style={[styles.badge, { backgroundColor: palette.badgeBg }, collapsed && styles.badgeCollapsed]}>
            <Text style={[styles.badgeText, { color: palette.badgeText }]}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export function Sidebar({
  activeKey,
  onNavigate,
  onOpenProfile,
  badgeCounts,
  collapsed,
  onToggleCollapse,
}: {
  activeKey: SidebarNavKey | null;
  onNavigate: (key: SidebarNavKey) => void;
  onOpenProfile: () => void;
  badgeCounts?: Partial<Record<SidebarNavKey, number>>;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { palette, tone } = useKISTheme();
  const { themeMode, setThemeMode } = useThemeMode();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const displayName = user?.display_name || user?.profile?.display_name || user?.username || 'Guest';
  const handle = user?.username ? `@${user.username}` : '';
  const initials = displayName.trim().slice(0, 2).toUpperCase() || 'U';
  const isDark = tone === 'dark';

  return (
    <View
      style={[
        styles.wrap,
        {
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
          backgroundColor: palette.royalSurface,
          borderColor: palette.goldBorder,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16),
          shadowColor: palette.shadow,
        },
      ]}
    >
      <View style={[styles.logoRow, collapsed && styles.logoRowCollapsed]}>
        <LinearGradient
          colors={(tone === 'dark' ? KIS_ROYAL_GRADIENTS.goldDark : KIS_ROYAL_GRADIENTS.goldLight) as unknown as string[]}
          style={styles.logoMark}
        >
          <Text style={[styles.logoMarkText, { color: isDark ? palette.royalInk : palette.ivory }]}>K</Text>
        </LinearGradient>
        {!collapsed ? (
          <View>
            <Text style={[styles.logoTitle, { color: palette.text }]}>KIS</Text>
            <Text style={[styles.logoSubtitle, { color: palette.subtext }]} numberOfLines={1}>
              Kingdom Impact Social
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        style={styles.navScroll}
        contentContainerStyle={styles.navContent}
        showsVerticalScrollIndicator={false}
      >
        {NAV_ITEMS.map((item) => (
          <SidebarItem
            key={item.key}
            label={item.label}
            icon={item.icon}
            active={activeKey === item.key}
            collapsed={collapsed}
            badge={badgeCounts?.[item.key]}
            onPress={() => onNavigate(item.key)}
          />
        ))}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: palette.divider }]}>
        <Pressable
          onPress={onOpenProfile}
          accessibilityRole="button"
          accessibilityLabel="View profile"
          style={[styles.profileRow, collapsed && styles.profileRowCollapsed]}
        >
          <LinearGradient
            colors={(tone === 'dark' ? KIS_ROYAL_GRADIENTS.goldDark : KIS_ROYAL_GRADIENTS.goldLight) as unknown as string[]}
            style={styles.avatar}
          >
            <Text style={[styles.avatarText, { color: isDark ? palette.royalInk : palette.ivory }]}>{initials}</Text>
          </LinearGradient>
          {!collapsed ? (
            <View style={styles.profileTextWrap}>
              <Text style={[styles.profileName, { color: palette.text }]} numberOfLines={1}>
                {displayName}
              </Text>
              {handle ? (
                <Text style={[styles.profileHandle, { color: palette.subtext }]} numberOfLines={1}>
                  {handle}
                </Text>
              ) : null}
              <Text style={[styles.profileLink, { color: palette.goldReadable }]}>View profile ›</Text>
            </View>
          ) : null}
        </Pressable>

        <View style={[styles.controlsRow, collapsed && styles.controlsRowCollapsed]}>
          <View style={[styles.themePill, { borderColor: palette.goldBorder, backgroundColor: palette.surface }]}>
            <Pressable
              onPress={() => setThemeMode('light')}
              accessibilityRole="button"
              accessibilityLabel="Light theme"
              style={[styles.themeOption, themeMode === 'light' && { backgroundColor: palette.selectedBg }]}
            >
              <Ionicons name="sunny-outline" size={16} color={themeMode === 'light' ? palette.goldReadable : palette.subtext} />
            </Pressable>
            <Pressable
              onPress={() => setThemeMode('dark')}
              accessibilityRole="button"
              accessibilityLabel="Dark theme"
              style={[styles.themeOption, themeMode === 'dark' && { backgroundColor: palette.selectedBg }]}
            >
              <Ionicons name="moon-outline" size={16} color={themeMode === 'dark' ? palette.goldReadable : palette.subtext} />
            </Pressable>
          </View>
          {!collapsed ? (
            <Pressable
              onPress={onToggleCollapse}
              accessibilityRole="button"
              accessibilityLabel="Collapse sidebar"
              style={[styles.collapseBtn, { borderColor: palette.goldBorder, backgroundColor: palette.surface }]}
            >
              <Ionicons name="chevron-back-outline" size={16} color={palette.subtext} />
            </Pressable>
          ) : null}
        </View>
        {collapsed ? (
          <Pressable
            onPress={onToggleCollapse}
            accessibilityRole="button"
            accessibilityLabel="Expand sidebar"
            style={[styles.collapseBtn, styles.collapseBtnCollapsed, { borderColor: palette.goldBorder, backgroundColor: palette.surface }]}
          >
            <Ionicons name="chevron-forward-outline" size={16} color={palette.subtext} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRightWidth: 1,
    paddingHorizontal: 12,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 6, height: 0 },
    elevation: 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  logoRowCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: { fontSize: 20, fontWeight: '900' },
  logoTitle: { fontSize: 20, fontWeight: '900' },
  logoSubtitle: { fontSize: 11, fontWeight: '600' },
  navScroll: { flex: 1 },
  navContent: { gap: 4, paddingBottom: 12 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 18,
  },
  itemCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  itemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconWrapCollapsed: { width: 44, height: 44 },
  itemLabel: { fontSize: 15, flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCollapsed: { position: 'absolute', top: 2, right: 2 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  footer: {
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 8,
    gap: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  profileRowCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '900' },
  profileTextWrap: { flex: 1 },
  profileName: { fontSize: 14, fontWeight: '800' },
  profileHandle: { fontSize: 12, fontWeight: '600' },
  profileLink: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    gap: 8,
  },
  controlsRowCollapsed: { justifyContent: 'center' },
  themePill: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  themeOption: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseBtnCollapsed: {
    alignSelf: 'center',
    marginTop: 4,
  },
});

export default Sidebar;
