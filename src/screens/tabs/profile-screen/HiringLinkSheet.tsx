// src/screens/tabs/profile-screen/HiringLinkSheet.tsx
//
// Section 3/7 of the spec: when a user picks "Hiring" in ProfileScreen's
// avatar-status picker, let them either link one of their own ACTIVE
// apps.commerce JobListing postings (the real, existing job board - see
// apps/commerce/business_models.py - NOT a new job-posting system) or just
// activate Hiring with no link. Re-openable later to change/clear the link,
// not only on first activation.
//
// Default when first activating Hiring with no prior link: "Don't link a
// listing" is preselected - activating the ring is a lightweight signal a
// user can flip on immediately, while linking a specific posting is an
// optional extra step, not a requirement to show the ring at all (mirrors
// Profile.hiring_job_listing's own docstring on the backend).
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import KISButton from '@/constants/KISButton';
import type { KISPalette } from '@/theme/constants';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

export type OwnJobListing = {
  id: string;
  title: string;
  location?: string;
  remote_allowed?: boolean;
  is_active?: boolean;
};

type Props = {
  visible: boolean;
  palette: KISPalette;
  currentUserId?: string | null;
  initialListingId?: string | null;
  saving?: boolean;
  onSave: (listingId: string | null) => void;
  onClose: () => void;
};

function RadioDot({ selected, color, subtext }: { selected: boolean; color: string; subtext: string }) {
  return (
    <View
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: selected ? color : subtext,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} /> : null}
    </View>
  );
}

export default function HiringLinkSheet({
  visible,
  palette,
  currentUserId,
  initialListingId,
  saving = false,
  onSave,
  onClose,
}: Props) {
  const topInset = useSafeTopInset();
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState<OwnJobListing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialListingId ?? null);

  useEffect(() => {
    if (!visible) return;
    setSelectedId(initialListingId ?? null);
    if (!currentUserId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const url = `${ROUTES.business.jobs}?poster=${encodeURIComponent(currentUserId)}&is_active=true`;
        const res = await getRequest(url, { errorMessage: '' });
        const raw = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
        if (!cancelled) {
          setListings(
            raw.map((j: any) => ({
              id: String(j.id),
              title: String(j.title ?? 'Untitled listing'),
              location: j.location ?? '',
              remote_allowed: !!j.remote_allowed,
              is_active: j.is_active !== false,
            })),
          );
        }
      } catch {
        if (!cancelled) setListings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, currentUserId, initialListingId]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: palette.surface, paddingTop: Math.max(12, topInset * 0.2) }]}>
          <View style={styles.handle} />
          <Text style={[styles.title, { color: palette.text }]}>Hiring</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Optionally link one of your active job postings - tapping your Hiring ring will take people straight there.
          </Text>

          {loading ? (
            <ActivityIndicator color={palette.purple} style={{ marginVertical: 20 }} />
          ) : (
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              <Pressable
                onPress={() => setSelectedId(null)}
                style={[
                  styles.row,
                  { borderColor: selectedId === null ? palette.purple : 'rgba(128,128,128,0.3)' },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedId === null }}
              >
                <RadioDot selected={selectedId === null} color={palette.purple} subtext={palette.subtext} />
                <Text style={{ color: palette.text, fontWeight: '600', marginLeft: 10 }}>
                  Don't link a listing
                </Text>
              </Pressable>

              {listings.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 8 }}>
                  You have no active job postings to link yet.
                </Text>
              ) : (
                listings.map((job) => {
                  const selected = selectedId === job.id;
                  return (
                    <Pressable
                      key={job.id}
                      onPress={() => setSelectedId(job.id)}
                      style={[styles.row, { borderColor: selected ? palette.purple : 'rgba(128,128,128,0.3)' }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <RadioDot selected={selected} color={palette.purple} subtext={palette.subtext} />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={{ color: palette.text, fontWeight: '700' }} numberOfLines={1}>
                          {job.title}
                        </Text>
                        {job.location ? (
                          <Text style={{ color: palette.subtext, fontSize: 12 }} numberOfLines={1}>
                            {job.location}{job.remote_allowed ? ' - Remote OK' : ''}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          )}

          <View style={styles.actionsRow}>
            <KISButton title="Cancel" variant="ghost" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
            <KISButton
              title="Save"
              variant="primary"
              onPress={() => onSave(selectedId)}
              loading={saving}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: '85%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', marginBottom: 10 },
  title: { fontSize: 17, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1.5, marginTop: 8 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
