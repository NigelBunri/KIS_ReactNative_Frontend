import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { PartnerAuditEvent } from '@/components/partners/partnersTypes';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

export default function PartnerAuditPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  partnerId,
  onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [events, setEvents] = useState<PartnerAuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const loadEvents = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.auditEvents(partnerId), {
      errorMessage: 'Unable to load audit events.',
    });
    if (!res?.success) {
      setError(res?.message || "Couldn't load audit events. Tap to retry.");
      setEvents([]);
      return;
    }
    setError(null);
    const list = (res?.data ?? []) as PartnerAuditEvent[];
    setEvents(Array.isArray(list) ? list : []);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    loadEvents().finally(() => setLoading(false));
  }, [isOpen, loadEvents]);

  if (!isOpen) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.settingsPanelBackdrop,
          { backgroundColor: palette.backdrop, opacity: backdropOpacity },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          {
            width: panelWidth,
            backgroundColor: palette.surfaceElevated,
            borderLeftColor: palette.divider,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        <View
          style={[
            styles.settingsPanelHeader,
            { borderBottomColor: palette.divider },
          ]}
        >
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              Audit Log
            </Text>
            <Text
              style={[
                styles.settingsPanelDescription,
                { color: palette.subtext },
              ]}
            >
              Administrative actions and governance events.
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.settingsPanelBody}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : error ? (
            <View
              style={{
                borderRadius: 10,
                borderWidth: 1,
                borderColor: palette.danger,
                backgroundColor: palette.danger + '15',
                padding: 12,
              }}
            >
              <Text style={{ color: palette.danger, fontSize: 13, fontWeight: '600' }}>{error}</Text>
              <Pressable
                onPress={() => {
                  setLoading(true);
                  loadEvents().finally(() => setLoading(false));
                }}
                style={{ marginTop: 8 }}
              >
                <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 13 }}>Tap to retry</Text>
              </Pressable>
            </View>
          ) : events.length === 0 ? (
            <Text style={{ color: palette.subtext }}>No audit events yet.</Text>
          ) : (
            events.map((event) => (
              <View
                key={String(event.id)}
                style={[
                  styles.settingsFeatureRow,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.borderMuted,
                  },
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  {event.action}
                </Text>
                <Text style={[styles.settingsFeatureDescription, { color: palette.subtext }]}>
                  {event.actor_name ?? 'System'} · {event.target_type || 'partner'}
                </Text>
                <Text style={[styles.settingsFeatureMeta, { color: palette.subtext }]}>
                  {event.created_at ? new Date(event.created_at).toLocaleString() : ''}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
