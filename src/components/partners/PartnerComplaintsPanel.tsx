import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import styles from '@/components/partners/partnersStyles';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  onClose: () => void;
};

type ComplaintRecord = {
  id: string;
  booking_reference?: string;
  transaction_reference?: string;
  status?: string;
  status_display?: string;
  action?: string;
  action_display?: string;
  receipt_url?: string;
  personal_statement?: string;
  reason?: string;
  service_name?: string;
  shop_name?: string;
  provider_info?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  resolved_at?: string;
  resolution_note?: string;
  booking_status?: string;
  escrow_status?: string;
  submitted_by?: string | null;
  provider?: string | null;
};

export default function PartnerComplaintsPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<{ id: string | null; action: 'release' | 'refund' | null }>({
    id: null,
    action: null,
  });

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.commerce.serviceBookingComplaints, {
        errorMessage: 'Unable to load complaints.',
        forceNetwork: true,
      });
      if (res?.success) {
        const data = res?.data ?? res;
        const list = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
          ? data
          : [];
        setComplaints(list);
      } else {
        setComplaints([]);
      }
    } catch (err: any) {
      console.warn('Complaints fetch failed', err);
      setComplaints([]);
      setError(err?.message || 'Unable to load complaints.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadComplaints();
  }, [isOpen, loadComplaints]);

  const resolveComplaint = useCallback(
    async (complaintId: string, action: 'release' | 'refund') => {
      setResolving({ id: complaintId, action });
      try {
        const note = resolutionNotes[complaintId] ?? '';
        const res = await postRequest(
          `${ROUTES.commerce.serviceBookingComplaint(complaintId)}resolve/`,
          { action, note },
          { errorMessage: 'Unable to resolve complaint.' },
        );
        if (!res?.success) {
          throw new Error(res?.message || 'Unable to resolve complaint.');
        }
        Alert.alert('Complaint', `Payment ${action === 'release' ? 'released' : 'refunded'} successfully.`);
        loadComplaints();
      } catch (err: any) {
        Alert.alert('Complaint', err?.message || 'Unable to resolve complaint.');
      } finally {
        setResolving({ id: null, action: null });
      }
    },
    [resolutionNotes, loadComplaints],
  );

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
        <View style={[styles.settingsPanelHeader, { borderBottomColor: palette.divider }]}> 
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Complaints</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>Review KCAN booking disputes and resolve escrow funds.</Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.settingsPanelBody}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator color={palette.primaryStrong} />
          ) : error ? (
            <Text style={{ color: palette.error }}>{error}</Text>
          ) : complaints.length === 0 ? (
            <Text style={{ color: palette.subtext }}>No complaints awaiting review.</Text>
          ) : (
            complaints.map((complaint) => {
              const isResolved = complaint.status === 'resolved';
              const isPending = complaint.status !== 'resolved';
              const statusColor = isResolved ? palette.success : palette.warning;
              return (
                <View
                  key={complaint.id}
                  style={{
                    gap: 8,
                    borderWidth: 1,
                    borderColor: palette.divider,
                    borderRadius: 14,
                    padding: 12,
                    backgroundColor: palette.surface,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: palette.text, fontWeight: '700' }}>
                      {complaint.shop_name || 'Complaints'}
                    </Text>
                    <Text style={{ color: statusColor, fontWeight: '600' }}>
                      {complaint.status_display || complaint.status || 'Status unknown'}
                    </Text>
                  </View>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Booking ref: {complaint.booking_reference || '—'}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Transaction: {complaint.transaction_reference || '—'}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Booking status: {complaint.booking_status || '—'} • Escrow: {complaint.escrow_status || '—'}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Submitted by: {complaint.submitted_by || 'unknown'}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Provider: {complaint.provider || 'unknown'}
                  </Text>
                  {complaint.provider_info ? (
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      Provider info: {complaint.provider_info?.shop_name ?? '—'} · {complaint.provider_info?.service_name ?? '—'}
                    </Text>
                  ) : null}
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Personal statement:
                  </Text>
                  <Text style={{ color: palette.text }}>{complaint.personal_statement || 'Not provided.'}</Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Reason:
                  </Text>
                  <Text style={{ color: palette.text }}>{complaint.reason || 'Not provided.'}</Text>
                  {complaint.receipt_url ? (
                    <Pressable
                      onPress={() =>
                        Linking.openURL(complaint.receipt_url as string).catch(() => {
                          Alert.alert('Receipt', 'Unable to open receipt.');
                        })
                      }
                    >
                      <Text style={{ color: palette.primaryStrong }}>View receipt</Text>
                    </Pressable>
                  ) : null}
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Created: {complaint.created_at ? new Date(complaint.created_at).toLocaleString() : '—'}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Updated: {complaint.updated_at ? new Date(complaint.updated_at).toLocaleString() : '—'}
                  </Text>
                  <KISTextInput
                    label="Resolution note"
                    value={resolutionNotes[complaint.id] ?? complaint.resolution_note ?? ''}
                    onChangeText={(text) =>
                      setResolutionNotes((prev) => ({ ...prev, [complaint.id]: text }))
                    }
                    multiline
                    numberOfLines={2}
                  />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <KISButton
                      title="Release Payment"
                      size="xs"
                      variant="secondary"
                      disabled={!isPending || resolving.id === complaint.id}
                      loading={resolving.id === complaint.id && resolving.action === 'release'}
                      onPress={() => resolveComplaint(complaint.id, 'release')}
                    />
                    <KISButton
                      title="Refund Payment"
                      size="xs"
                      variant="outline"
                      style={{ borderColor: palette.error || '#E53935' }}
                      textStyle={{ color: palette.error || '#E53935' }}
                      disabled={!isPending || resolving.id === complaint.id}
                      loading={resolving.id === complaint.id && resolving.action === 'refund'}
                      onPress={() => resolveComplaint(complaint.id, 'refund')}
                    />
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
