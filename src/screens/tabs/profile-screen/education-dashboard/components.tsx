import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import type { KISPalette } from '@/theme/constants';

type EducationTone = 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'muted';

type EducationScreenScaffoldProps = {
  palette: KISPalette;
  breadcrumb?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: ViewStyle;
};

type EducationWorkspaceHeaderProps = {
  palette: KISPalette;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  statusLabel?: string;
  visibilityLabel?: string;
  roleLabel?: string;
  actions?: React.ReactNode;
  secondaryActions?: React.ReactNode;
};

type EducationSectionCardProps = {
  palette: KISPalette;
  title: string;
  description?: string;
  eyebrow?: string;
  badge?: string;
  meta?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  footer?: React.ReactNode;
  children?: React.ReactNode;
};

type EducationMetricTileProps = {
  palette: KISPalette;
  label: string;
  value: string | number;
  hint?: string;
  tone?: EducationTone;
};

type EducationStatusBadgeProps = {
  palette: KISPalette;
  label: string;
  tone?: EducationTone;
};

type EducationActionButtonProps = {
  palette: KISPalette;
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
};

type EducationListCardProps = {
  palette: KISPalette;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  imageUrl?: string | null;
  statusLabel?: string;
  statusTone?: EducationTone;
  metaItems?: string[];
  onPress?: () => void;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  children?: React.ReactNode;
};

type EducationEmptyStateProps = {
  palette: KISPalette;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

type EducationTimelineItemProps = {
  palette: KISPalette;
  title: string;
  description?: string;
  timestamp?: string;
  tone?: EducationTone;
};

const getToneColors = (palette: KISPalette, tone: EducationTone = 'default') => {
  switch (tone) {
    case 'success':
      return {
        bg: palette.successSoft ?? 'rgba(34,197,94,0.14)',
        border: `${palette.success}44`,
        text: palette.success,
      };
    case 'warning':
      return {
        bg: `${palette.warning}18`,
        border: `${palette.warning}44`,
        text: palette.warning,
      };
    case 'danger':
      return {
        bg: palette.dangerSoft ?? 'rgba(239,68,68,0.14)',
        border: `${palette.danger}44`,
        text: palette.danger,
      };
    case 'accent':
      return {
        bg: palette.primarySoft ?? 'rgba(255,138,51,0.15)',
        border: `${palette.primaryStrong}44`,
        text: palette.primaryStrong ?? palette.primary,
      };
    case 'muted':
      return {
        bg: `${palette.borderMuted ?? palette.divider}66`,
        border: `${palette.borderMuted ?? palette.divider}99`,
        text: palette.subtext,
      };
    default:
      return {
        bg: `${palette.surfaceElevated ?? palette.card}CC`,
        border: `${palette.divider}AA`,
        text: palette.text,
      };
  }
};

const getSurface = (palette: KISPalette) => ({
  backgroundColor: `${palette.surfaceElevated ?? palette.card}F0`,
  borderColor: `${palette.divider}AA`,
  shadowColor: palette.shadow,
});

export function EducationScreenScaffold({
  palette,
  breadcrumb,
  title,
  subtitle,
  onBack,
  actions,
  children,
  scrollable = true,
  contentContainerStyle,
}: EducationScreenScaffoldProps) {
  const header = (
    <View style={[styles.scaffoldHeader, getSurface(palette)]}>
      <View style={styles.scaffoldHeaderTopRow}>
        <View style={styles.scaffoldTitleWrap}>
          {breadcrumb ? (
            <Text style={[styles.scaffoldBreadcrumb, { color: palette.subtext }]}>{breadcrumb}</Text>
          ) : null}
          <Text style={[styles.scaffoldTitle, { color: palette.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.scaffoldSubtitle, { color: palette.subtext }]}>{subtitle}</Text>
          ) : null}
        </View>
        <View style={styles.scaffoldActions}>
          {actions}
          {onBack ? (
            <EducationActionButton
              palette={palette}
              label="Back"
              onPress={onBack}
              variant="secondary"
            />
          ) : null}
        </View>
      </View>
    </View>
  );

  if (!scrollable) {
    return (
      <View style={[styles.scaffoldRoot, { backgroundColor: palette.bg }]}>
        {header}
        <View style={[styles.scaffoldContent, contentContainerStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scaffoldRoot, { backgroundColor: palette.bg }]}
      contentContainerStyle={[styles.scaffoldContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    >
      {header}
      {children}
    </ScrollView>
  );
}

export function EducationWorkspaceHeader({
  palette,
  eyebrow,
  title,
  subtitle,
  imageUrl,
  statusLabel,
  visibilityLabel,
  roleLabel,
  actions,
  secondaryActions,
}: EducationWorkspaceHeaderProps) {
  const badges = [statusLabel, visibilityLabel, roleLabel].filter(Boolean) as string[];

  return (
    <View style={[styles.workspaceHeader, getSurface(palette)]}>
      <View style={styles.workspaceHeaderRow}>
        <View style={styles.workspaceMediaWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={[styles.workspaceImage, { borderColor: `${palette.divider}99` }]} />
          ) : (
            <View
              style={[
                styles.workspaceImageFallback,
                {
                  backgroundColor: `${palette.primaryStrong}18`,
                  borderColor: `${palette.primaryStrong}55`,
                },
              ]}
            >
              <Text style={[styles.workspaceImageFallbackText, { color: palette.primaryStrong }]}>
                {title.trim().slice(0, 2).toUpperCase() || 'ED'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.workspaceCopy}>
          {eyebrow ? (
            <Text style={[styles.workspaceEyebrow, { color: palette.primaryStrong }]}>{eyebrow}</Text>
          ) : null}
          <Text style={[styles.workspaceTitle, { color: palette.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.workspaceSubtitle, { color: palette.subtext }]}>{subtitle}</Text>
          ) : null}
          {badges.length ? (
            <View style={styles.workspaceBadgeRow}>
              {badges.map((badge, index) => (
                <EducationStatusBadge key={`${badge}-${index}`} palette={palette} label={badge} tone="accent" />
              ))}
            </View>
          ) : null}
        </View>
      </View>
      {actions ? <View style={styles.workspaceActionRow}>{actions}</View> : null}
      {secondaryActions ? <View style={styles.workspaceSecondaryRow}>{secondaryActions}</View> : null}
    </View>
  );
}

export function EducationSectionCard({
  palette,
  title,
  description,
  eyebrow,
  badge,
  meta,
  icon,
  onPress,
  footer,
  children,
}: EducationSectionCardProps) {
  const body = (
    <View style={[styles.sectionCard, getSurface(palette)]}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderCopy}>
          {eyebrow ? <Text style={[styles.sectionEyebrow, { color: palette.primaryStrong }]}>{eyebrow}</Text> : null}
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
          {description ? (
            <Text style={[styles.sectionDescription, { color: palette.subtext }]}>{description}</Text>
          ) : null}
        </View>
        {icon ? <View style={styles.sectionIconWrap}>{icon}</View> : null}
      </View>
      {badge || meta ? (
        <View style={styles.sectionMetaRow}>
          {badge ? <EducationStatusBadge palette={palette} label={badge} tone="accent" /> : null}
          {meta ? <Text style={[styles.sectionMeta, { color: palette.subtext }]}>{meta}</Text> : null}
        </View>
      ) : null}
      {children}
      {footer ? <View style={styles.sectionFooter}>{footer}</View> : null}
    </View>
  );

  if (!onPress) {
    return body;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

export function EducationMetricTile({
  palette,
  label,
  value,
  hint,
  tone = 'default',
}: EducationMetricTileProps) {
  const toneColors = getToneColors(palette, tone);
  return (
    <View
      style={[
        styles.metricTile,
        {
          backgroundColor: toneColors.bg,
          borderColor: toneColors.border,
          shadowColor: palette.shadow,
        },
      ]}
    >
      <Text style={[styles.metricLabel, { color: palette.subtext }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: palette.text }]}>{value}</Text>
      {hint ? <Text style={[styles.metricHint, { color: toneColors.text }]}>{hint}</Text> : null}
    </View>
  );
}

export function EducationStatusBadge({
  palette,
  label,
  tone = 'default',
}: EducationStatusBadgeProps) {
  const toneColors = getToneColors(palette, tone);
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: toneColors.bg,
          borderColor: toneColors.border,
        },
      ]}
    >
      <Text style={[styles.badgeText, { color: toneColors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function EducationActionButton({
  palette,
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
}: EducationActionButtonProps) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isPrimary
          ? {
              backgroundColor: palette.primaryStrong,
              borderColor: palette.primaryStrong,
            }
          : isGhost
            ? {
                backgroundColor: 'transparent',
                borderColor: `${palette.divider}AA`,
              }
            : {
                backgroundColor: `${palette.surfaceElevated ?? palette.card}CC`,
                borderColor: `${palette.divider}AA`,
              },
        disabled && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {icon ? <View style={styles.buttonIcon}>{icon}</View> : null}
      <Text
        style={[
          styles.buttonLabel,
          {
            color: isPrimary ? palette.onPrimary : palette.text,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function EducationListCard({
  palette,
  title,
  subtitle,
  eyebrow,
  imageUrl,
  statusLabel,
  statusTone = 'default',
  metaItems,
  onPress,
  primaryAction,
  secondaryAction,
  children,
}: EducationListCardProps) {
  const body = (
    <View
      style={[
        styles.listCard,
        getSurface(palette),
        {
          borderWidth: 1.5,
          borderColor: `${palette.primaryStrong}66`,
          backgroundColor: `${palette.surfaceElevated ?? palette.card}F6`,
        },
      ]}
    >
      <View style={styles.listCardHeader}>
        <View style={styles.listCardHeaderMain}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={[styles.listCardImage, { borderColor: `${palette.divider}99`, backgroundColor: palette.background }]}
              resizeMode="cover"
            />
          ) : null}
          <View style={styles.listCardCopy}>
            {eyebrow ? <Text style={[styles.listEyebrow, { color: palette.primaryStrong }]}>{eyebrow}</Text> : null}
            <Text style={[styles.listTitle, { color: palette.text }]}>{title}</Text>
            {subtitle ? <Text style={[styles.listSubtitle, { color: palette.subtext }]}>{subtitle}</Text> : null}
          </View>
        </View>
        {statusLabel ? (
          <EducationStatusBadge palette={palette} label={statusLabel} tone={statusTone} />
        ) : null}
      </View>
      {metaItems?.length ? (
        <View style={styles.listMetaRow}>
          {metaItems.filter(Boolean).map((item, index) => (
            <Text key={`${item}-${index}`} style={[styles.listMetaText, { color: palette.subtext }]}>
              {item}
            </Text>
          ))}
        </View>
      ) : null}
      {children}
      {primaryAction || secondaryAction ? (
        <View style={styles.listActionRow}>
          {primaryAction}
          {secondaryAction}
        </View>
      ) : null}
    </View>
  );

  if (!onPress) {
    return body;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

export function EducationEmptyState({
  palette,
  title,
  description,
  action,
}: EducationEmptyStateProps) {
  return (
    <View style={[styles.emptyState, getSurface(palette)]}>
      <View
        style={[
          styles.emptyGlyph,
          {
            backgroundColor: `${palette.primaryStrong}16`,
            borderColor: `${palette.primaryStrong}40`,
          },
        ]}
      >
        <Text style={[styles.emptyGlyphText, { color: palette.primaryStrong }]}>ED</Text>
      </View>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>{title}</Text>
      {description ? <Text style={[styles.emptyDescription, { color: palette.subtext }]}>{description}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function EducationTimelineItem({
  palette,
  title,
  description,
  timestamp,
  tone = 'accent',
}: EducationTimelineItemProps) {
  const toneColors = getToneColors(palette, tone);
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View
          style={[
            styles.timelineDot,
            {
              backgroundColor: toneColors.text,
              shadowColor: palette.shadow,
            },
          ]}
        />
        <View style={[styles.timelineLine, { backgroundColor: `${palette.divider}99` }]} />
      </View>
      <View style={[styles.timelineCard, getSurface(palette)]}>
        <View style={styles.timelineHeader}>
          <Text style={[styles.timelineTitle, { color: palette.text }]}>{title}</Text>
          {timestamp ? <Text style={[styles.timelineTime, { color: palette.subtext }]}>{timestamp}</Text> : null}
        </View>
        {description ? (
          <Text style={[styles.timelineDescription, { color: palette.subtext }]}>{description}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scaffoldRoot: {
    flex: 1,
  },
  scaffoldContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  scaffoldHeader: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    marginBottom: 4,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 8,
  },
  scaffoldHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  scaffoldTitleWrap: {
    flex: 1,
    gap: 6,
  },
  scaffoldActions: {
    alignItems: 'flex-end',
    gap: 10,
  },
  scaffoldBreadcrumb: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  scaffoldTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  scaffoldSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 560,
  },
  workspaceHeader: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 10,
  },
  workspaceHeaderRow: {
    flexDirection: 'row',
    gap: 16,
  },
  workspaceMediaWrap: {
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  workspaceImage: {
    width: 84,
    height: 84,
    borderRadius: 24,
    borderWidth: 1,
  },
  workspaceImageFallback: {
    width: 84,
    height: 84,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workspaceImageFallbackText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  workspaceCopy: {
    flex: 1,
    gap: 8,
  },
  workspaceEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  workspaceTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  workspaceSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  workspaceBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  workspaceActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  workspaceSecondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  sectionIconWrap: {
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  sectionMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionFooter: {
    marginTop: 4,
  },
  metricTile: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 6,
    minWidth: 140,
    flex: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  metricHint: {
    fontSize: 12,
    fontWeight: '700',
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  button: {
    minHeight: 42,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  listCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 5,
  },
  listCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  listCardHeaderMain: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  listCardImage: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderWidth: 1,
  },
  listCardCopy: {
    flex: 1,
    gap: 5,
  },
  listEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  listSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  listMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  listMetaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  emptyState: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    gap: 10,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  emptyGlyph: {
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGlyphText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 420,
  },
  emptyAction: {
    marginTop: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  timelineRail: {
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 8,
    borderRadius: 999,
  },
  timelineCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 6,
    minHeight: 76,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'flex-start',
  },
  timelineTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  timelineTime: {
    fontSize: 12,
    fontWeight: '700',
  },
  timelineDescription: {
    fontSize: 14,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
});
