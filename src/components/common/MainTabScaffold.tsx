import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import KISButton from '@/constants/KISButton';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import { cardStyles, KIS_TOKENS, selectedControlStyles } from '@/theme/constants';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';

type HeaderAction = {
  label: string;
  icon?: KISIconName;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function MainTabPageHeader({
  eyebrow,
  title,
  subtitle,
  primaryAction,
  secondaryAction,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  primaryAction?: HeaderAction;
  secondaryAction?: HeaderAction;
}) {
  const { palette, tone } = useKISTheme();
  const responsive = useResponsiveLayout();
  const selected = selectedControlStyles(tone);

  return (
    <View
      accessibilityRole="header"
      style={[
        styles.header,
        {
          backgroundColor: palette.royalSurface,
          borderColor: palette.goldBorder,
          borderRadius: responsive.isWatch ? 16 : responsive.isCompactPhone ? 20 : 24,
          padding: responsive.isWatch ? 10 : responsive.isCompactPhone ? 12 : 16,
          gap: responsive.isWatch ? 8 : 14,
        },
      ]}
    >
      <View style={styles.headerTextWrap}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: palette.goldReadable }]} numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
        <Text
          style={[
            styles.title,
            {
              color: palette.text,
              fontSize: responsive.headerTitleSize,
              lineHeight: Math.round(responsive.headerTitleSize * 1.2),
            },
          ]}
          numberOfLines={responsive.isWatch ? 2 : 1}
          adjustsFontSizeToFit
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.subtitle,
              {
                color: palette.subtext,
                fontSize: responsive.bodyFontSize,
                lineHeight: Math.round(responsive.bodyFontSize * 1.42),
              },
            ]}
            numberOfLines={responsive.isWatch ? 3 : 2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {(primaryAction || secondaryAction) ? (
        <View style={[styles.actions, responsive.isWatch && styles.actionsCompact]}>
          {secondaryAction ? (
            <Pressable
              onPress={secondaryAction.onPress}
              accessibilityRole="button"
              accessibilityLabel={secondaryAction.accessibilityLabel || secondaryAction.label}
              style={[selected.container, styles.headerAction, responsive.isWatch && styles.headerActionCompact]}
            >
              {secondaryAction.icon ? (
                <KISIcon name={secondaryAction.icon} size={16} color={palette.selectedText} />
              ) : null}
              <Text style={selected.text} numberOfLines={1}>
                {secondaryAction.label}
              </Text>
            </Pressable>
          ) : null}
          {primaryAction ? (
            <KISButton
              title={primaryAction.label}
              size="sm"
              onPress={primaryAction.onPress}
              left={
                primaryAction.icon ? (
                  <KISIcon name={primaryAction.icon} size={16} color={palette.onPrimary} />
                ) : undefined
              }
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function MainTabStateBlock({
  title,
  message,
  icon = 'info',
  loading,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  icon?: KISIconName;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { palette, tone } = useKISTheme();
  const responsive = useResponsiveLayout();
  const cards = cardStyles(tone);

  return (
    <View style={[cards.base, styles.stateBlock, { minHeight: responsive.isWatch ? 96 : 132, gap: responsive.cardGap }]}>
      <View style={[styles.stateIcon, { backgroundColor: palette.selectedBg }]}>
        {loading ? (
          <ActivityIndicator color={palette.goldReadable} />
        ) : (
          <KISIcon name={icon} size={22} color={palette.goldReadable} />
        )}
      </View>
      <View style={styles.stateCopy}>
        <Text style={[styles.stateTitle, { color: palette.text, fontSize: responsive.isWatch ? 15 : 18 }]}>{title}</Text>
        {message ? <Text style={[styles.stateMessage, { color: palette.subtext, fontSize: responsive.bodyFontSize }]}>{message}</Text> : null}
      </View>
      {actionLabel ? (
        <KISButton title={actionLabel} size="sm" variant="outline" onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 14,
  },
  headerTextWrap: {
    gap: 5,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  actionsCompact: {
    alignItems: 'stretch',
  },
  headerAction: {
    maxWidth: '100%',
  },
  headerActionCompact: {
    flexGrow: 1,
  },
  stateBlock: {
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateIcon: {
    width: KIS_TOKENS.accessibility.elderFriendlyTouchTarget,
    height: KIS_TOKENS.accessibility.elderFriendlyTouchTarget,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCopy: {
    gap: 4,
    alignItems: 'center',
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateMessage: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
});
