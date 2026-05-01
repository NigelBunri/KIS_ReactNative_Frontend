import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import TranslationPicker from './TranslationPicker';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { BibleTranslation } from '@/screens/tabs/bible/useBibleData';
import {
  LocalBiblePreference,
  mergeAndWriteLocalBiblePreference,
  readLocalBiblePreference,
  writeLocalBiblePreference,
} from '@/services/biblePreferenceStore';

type Props = {
  translations: BibleTranslation[];
};

type Preference = LocalBiblePreference;

type RegistryItem = {
  id: string;
  translation?: string | number | null;
  translation_name?: string;
  code: string;
  language: string;
  full_name?: string;
  abbreviation?: string;
  copyright_status?: string;
  license_review_status?: string;
  license_reviewed_at?: string;
  validation_status?: string;
  is_public?: boolean;
  is_licensed?: boolean;
  import_enabled?: boolean;
  can_be_public?: boolean;
  book_count?: number;
  chapter_count?: number;
  verse_count?: number;
  rights_holder?: string;
  license_notes?: string;
  last_scanned_at?: string;
  last_imported_at?: string;
};

type AuditItem = {
  id: string;
  partner_name?: string;
  user_name?: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata?: Record<string, any>;
  created_at: string;
};

const listFromResponse = (data: any) => {
  const payload = data?.results ?? data ?? [];
  return Array.isArray(payload) ? payload : [];
};

const boolText = (value?: boolean) => (value ? 'Yes' : 'No');

export default function BibleSettingsPanel({ translations }: Props) {
  const { palette } = useKISTheme();
  const [preference, setPreference] = useState<Preference | null>(null);
  const [loadingPreference, setLoadingPreference] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [registry, setRegistry] = useState<RegistryItem[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [controlRoomAllowed, setControlRoomAllowed] = useState(false);
  const [loadingControlRoom, setLoadingControlRoom] = useState(true);
  const [scanning, setScanning] = useState(false);

  const selectedTranslationCode = useMemo(() => {
    if (preference?.default_translation_code) return preference.default_translation_code;
    const id = preference?.default_translation;
    return translations.find((translation) => String(translation.id) === String(id))?.code ?? translations[0]?.code;
  }, [preference?.default_translation, preference?.default_translation_code, translations]);

  const loadPreference = async () => {
    setLoadingPreference(true);
    const local = await readLocalBiblePreference();
    if (local) setPreference(local);
    const res = await getRequest(ROUTES.bible.preferencesCurrent, {
      errorMessage: 'Unable to load Bible preferences.',
      forceNetwork: true,
    });
    if (local?.sync_status === 'local_pending') {
      const pendingPayload = { ...local };
      delete pendingPayload.sync_status;
      delete pendingPayload.updated_at;
      delete pendingPayload.default_translation_code;
      const syncRes = await patchRequest(ROUTES.bible.preferencesCurrent, pendingPayload, {
        errorMessage: 'Unable to sync local Bible preferences.',
      });
      if (syncRes?.success) {
        const synced = await writeLocalBiblePreference({ ...syncRes.data, ...local, sync_status: 'synced' });
        setPreference(synced);
        setLoadingPreference(false);
        return;
      }
    }
    if (res?.success) {
      const synced = await writeLocalBiblePreference({ ...res.data, sync_status: 'synced' });
      setPreference(synced);
    } else if (!local) {
      setMessage(res?.message || 'Bible preferences will be saved locally until login/API is available.');
      setPreference({ font_size: 16, audio_speed: 1, enable_audio_sync: true, enable_daily_reminders: true, enable_offline_cache: false });
    }
    setLoadingPreference(false);
  };

  const loadControlRoom = async () => {
    setLoadingControlRoom(true);
    const [registryRes, auditRes] = await Promise.all([
      getRequest(ROUTES.bible.translationRegistry, {
        errorMessage: 'Unable to load translation registry.',
        forceNetwork: true,
      }),
      getRequest(ROUTES.bible.contentAudit, {
        errorMessage: 'Unable to load content audit.',
        forceNetwork: true,
      }),
    ]);
    const allowed = Boolean(registryRes?.success || auditRes?.success);
    setControlRoomAllowed(allowed);
    if (registryRes?.success) setRegistry(listFromResponse(registryRes.data));
    if (auditRes?.success) setAudit(listFromResponse(auditRes.data));
    setLoadingControlRoom(false);
  };

  useEffect(() => {
    loadPreference();
    loadControlRoom();
  }, []);

  const savePreference = async (updates: Partial<Preference>) => {
    setSaving(true);
    const local = await mergeAndWriteLocalBiblePreference(updates, 'local_pending');
    setPreference(local);
    const res = await patchRequest(ROUTES.bible.preferencesCurrent, updates, {
      errorMessage: 'Unable to save Bible preference.',
    });
    setSaving(false);
    if (res?.success) {
      const synced = await writeLocalBiblePreference({ ...res.data, ...updates, sync_status: 'synced' });
      setPreference(synced);
      setMessage('Bible settings saved.');
    } else {
      setMessage(res?.message || 'Bible settings saved locally and will remain on this device.');
    }
  };

  const setDefaultTranslation = (code: string) => {
    const translation = translations.find((item) => item.code === code);
    if (!translation) return;
    savePreference({ default_translation: translation.id, default_translation_code: translation.code });
  };

  const updateRegistryFlag = async (item: RegistryItem, updates: Partial<RegistryItem>) => {
    const res = await patchRequest(`${ROUTES.bible.translationRegistry}${item.id}/`, updates, {
      errorMessage: 'Unable to update translation registry.',
    });
    if (res?.success) {
      setRegistry((prev) => prev.map((row) => (row.id === item.id ? { ...row, ...res.data } : row)));
      setMessage('Translation registry updated.');
    } else {
      setMessage(res?.message || 'Unable to update translation registry.');
    }
  };

  const scanRegistry = async () => {
    setScanning(true);
    const res = await postRequest(ROUTES.bible.translationRegistryScan, {}, {
      errorMessage: 'Unable to scan Bible translation files.',
    });
    setScanning(false);
    if (res?.success) {
      setMessage(`Translation scan complete: ${res.data?.count ?? 0} file(s).`);
      loadControlRoom();
    } else {
      setMessage(res?.message || 'Unable to scan Bible translation files.');
    }
  };

  const fontSize = Number(preference?.font_size || 16);
  const audioSpeed = Number(preference?.audio_speed || 1);

  const renderToggle = (label: string, value: boolean, key: keyof Preference, helper?: string) => (
    <View style={[styles.settingRow, { borderColor: palette.divider }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.text, fontWeight: '900' }}>{label}</Text>
        {helper ? <Text style={{ color: palette.subtext, marginTop: 3 }}>{helper}</Text> : null}
      </View>
      <Switch value={value} onValueChange={(next) => savePreference({ [key]: next })} />
    </View>
  );

  return (
    <View style={styles.stack}>
      <BibleSectionCard>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.text }]}>Settings</Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }}>
              Bible preferences, notification readiness, and KCAN-governed controls.
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: palette.primarySoft }]}>
            <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>KCAN</Text>
          </View>
        </View>
      </BibleSectionCard>

      <BibleSectionCard>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Reading preferences</Text>
        {loadingPreference ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={palette.primaryStrong} />
            <Text style={{ color: palette.subtext }}>Loading preferences...</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.label, { color: palette.subtext }]}>Default public/licensed translation</Text>
            <TranslationPicker translations={translations} selected={selectedTranslationCode} onSelect={setDefaultTranslation} />

            <View style={[styles.settingRow, { borderColor: palette.divider }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '900' }}>Font size</Text>
                <Text style={{ color: palette.subtext, marginTop: 3 }}>{fontSize}px reader text</Text>
              </View>
              <View style={styles.stepper}>
                <KISButton title="-" size="xs" variant="outline" onPress={() => savePreference({ font_size: Math.max(14, fontSize - 1) })} />
                <Text style={{ color: palette.text, minWidth: 28, textAlign: 'center', fontWeight: '900' }}>{fontSize}</Text>
                <KISButton title="+" size="xs" variant="outline" onPress={() => savePreference({ font_size: Math.min(26, fontSize + 1) })} />
              </View>
            </View>

            <View style={[styles.settingRow, { borderColor: palette.divider }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '900' }}>Audio speed</Text>
                <Text style={{ color: palette.subtext, marginTop: 3 }}>{audioSpeed.toFixed(2)}x playback speed</Text>
              </View>
              <View style={styles.stepper}>
                <KISButton
                  title="-"
                  size="xs"
                  variant="outline"
                  onPress={() => savePreference({ audio_speed: Math.max(0.75, audioSpeed - 0.25).toFixed(2) })}
                />
                <Text style={{ color: palette.text, minWidth: 42, textAlign: 'center', fontWeight: '900' }}>
                  {audioSpeed.toFixed(2)}
                </Text>
                <KISButton
                  title="+"
                  size="xs"
                  variant="outline"
                  onPress={() => savePreference({ audio_speed: Math.min(2, audioSpeed + 0.25).toFixed(2) })}
                />
              </View>
            </View>

            {renderToggle('Audio sync', Boolean(preference?.enable_audio_sync), 'enable_audio_sync', 'Keep audio playback linked to verse timing when audio exists.')}
            {renderToggle('Daily reminders', Boolean(preference?.enable_daily_reminders), 'enable_daily_reminders', 'Prepare daily passage reminder preferences for notifications.')}
            {renderToggle('Offline cache', Boolean(preference?.enable_offline_cache), 'enable_offline_cache', 'Mark Bible content for future offline cache support.')}

            <View style={[styles.noticeBox, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
              <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>Notification readiness</Text>
              <Text style={{ color: palette.subtext, marginTop: 4 }}>
                Reading planner events already store reminder offsets and channels. Push/alarm delivery remains a launch
                infrastructure task.
              </Text>
            </View>
          </>
        )}
        {saving ? <Text style={{ color: palette.subtext }}>Saving...</Text> : null}
        {preference?.sync_status === 'local_pending' ? (
          <Text style={{ color: palette.subtext }}>Saved on this device. It will sync when your account/API is available.</Text>
        ) : null}
        {message ? <Text style={{ color: palette.primaryStrong, fontWeight: '800' }}>{message}</Text> : null}
      </BibleSectionCard>

      {loadingControlRoom ? (
        <BibleSectionCard>
          <View style={styles.stateBox}>
            <ActivityIndicator color={palette.primaryStrong} />
            <Text style={{ color: palette.subtext }}>Checking KCAN control-room access...</Text>
          </View>
        </BibleSectionCard>
      ) : controlRoomAllowed ? (
        <BibleSectionCard>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>KCAN Control Room</Text>
              <Text style={{ color: palette.subtext, marginTop: 4 }}>
                Visible only when the current account can access KCAN admin Bible APIs.
              </Text>
            </View>
            <KISButton title={scanning ? 'Scanning...' : 'Scan'} size="xs" onPress={scanRegistry} disabled={scanning} />
          </View>

          <Text style={[styles.label, { color: palette.subtext }]}>Translation registry</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.registryRail}>
            {registry.slice(0, 12).map((item) => (
              <View key={item.id} style={[styles.registryCard, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
                <Text style={{ color: palette.text, fontWeight: '900' }} numberOfLines={2}>
                  {item.full_name || item.translation_name || item.code}
                </Text>
                <Text style={{ color: palette.subtext, marginTop: 4 }}>
                  {item.language} · {item.validation_status} · {item.copyright_status}
                </Text>
                <Text style={{ color: palette.subtext, marginTop: 4 }}>
                  Review: {item.license_review_status || 'pending'}
                  {item.license_reviewed_at ? ` · ${new Date(item.license_reviewed_at).toLocaleDateString()}` : ''}
                </Text>
                <Text style={{ color: palette.subtext, marginTop: 4 }}>
                  {item.book_count || 0} books · {item.chapter_count || 0} chapters · {item.verse_count || 0} verses
                </Text>
                <View style={styles.flagGrid}>
                  <TouchableOpacity
                    onPress={() => updateRegistryFlag(item, { license_review_status: 'approved' })}
                    style={[styles.flagChip, { borderColor: palette.divider }]}
                  >
                    <Text style={{ color: item.license_review_status === 'approved' ? palette.primaryStrong : palette.subtext, fontWeight: '800' }}>
                      Approve review
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateRegistryFlag(item, { license_review_status: 'rejected', is_public: false, is_licensed: false })}
                    style={[styles.flagChip, { borderColor: palette.divider }]}
                  >
                    <Text style={{ color: item.license_review_status === 'rejected' ? palette.primaryStrong : palette.subtext, fontWeight: '800' }}>
                      Reject
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateRegistryFlag(item, { is_licensed: !item.is_licensed })}
                    style={[styles.flagChip, { borderColor: palette.divider }]}
                  >
                    <Text style={{ color: item.is_licensed ? palette.primaryStrong : palette.subtext, fontWeight: '800' }}>
                      Licensed: {boolText(item.is_licensed)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateRegistryFlag(item, { is_public: !item.is_public })}
                    style={[styles.flagChip, { borderColor: palette.divider }]}
                  >
                    <Text style={{ color: item.is_public ? palette.primaryStrong : palette.subtext, fontWeight: '800' }}>
                      Public: {boolText(item.is_public)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateRegistryFlag(item, { import_enabled: !item.import_enabled })}
                    style={[styles.flagChip, { borderColor: palette.divider }]}
                  >
                    <Text style={{ color: item.import_enabled ? palette.primaryStrong : palette.subtext, fontWeight: '800' }}>
                      Import: {boolText(item.import_enabled)}
                    </Text>
                  </TouchableOpacity>
                </View>
                {item.rights_holder ? <Text style={{ color: palette.subtext }}>Rights: {item.rights_holder}</Text> : null}
                {item.license_notes ? (
                  <Text style={{ color: palette.subtext }} numberOfLines={2}>
                    {item.license_notes}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
          {!registry.length ? <Text style={{ color: palette.subtext }}>No registry rows are available yet. Run a scan.</Text> : null}

          <Text style={[styles.label, { color: palette.subtext }]}>Content audit</Text>
          <View style={styles.stack}>
            {audit.slice(0, 8).map((item) => (
              <View key={item.id} style={[styles.auditRow, { borderColor: palette.divider }]}>
                <View style={[styles.auditIcon, { backgroundColor: palette.primarySoft }]}>
                  <KISIcon name="settings" size={14} color={palette.primaryStrong} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: '900' }}>
                    {item.action} · {item.target_type}
                  </Text>
                  <Text style={{ color: palette.subtext, marginTop: 3 }}>
                    {item.user_name || 'KCAN'} · {new Date(item.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
            {!audit.length ? <Text style={{ color: palette.subtext }}>No content audit entries available yet.</Text> : null}
          </View>
        </BibleSectionCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '900' },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  label: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginTop: 4 },
  settingRow: { borderWidth: 2, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeBox: { borderWidth: 2, borderRadius: 12, padding: 12 },
  stateBox: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 10 },
  registryRail: { gap: 10, paddingVertical: 6 },
  registryCard: { borderWidth: 2, borderRadius: 12, padding: 12, width: 280, gap: 8 },
  flagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flagChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  auditRow: { borderWidth: 2, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  auditIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
