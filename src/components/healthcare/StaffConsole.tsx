import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KIS_TOKENS } from '@/theme/constants';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';

type StaffConsoleProps = {
  loading: boolean;
  staff: any[];
  profileId: string | null;
  updatingId: string | null;
  shiftLoadingId: string | null;
  onUpdateRole: (id: string, payload: { role?: string; scope?: string }) => Promise<void>;
  onAssignShift: (id: string, shifts: any[]) => Promise<void>;
};

export default function StaffConsole({
  loading,
  staff,
  profileId,
  updatingId,
  shiftLoadingId,
  onUpdateRole,
  onAssignShift,
}: StaffConsoleProps) {
  const { palette, tokens } = useKISTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const [formState, setFormState] = useState<Record<string, { role: string; scope: string; shiftNote: string }>>({});

  useEffect(() => {
    const next: Record<string, any> = {};
    staff.forEach((entry) => {
      next[entry.id] = {
        role: entry.role || '',
        scope: entry.scope ? String(entry.scope) : '',
        shiftNote: '',
      };
    });
    setFormState(next);
  }, [staff]);

  const handleChange = (id: string, field: keyof typeof formState[string], value: string) => {
    setFormState((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const summary = useMemo(() => {
    if (!profileId) return 'Select a profile to see staff.';
    if (!staff.length) return 'No staff configured yet.';
    return `${staff.length} staff assigned`;
  }, [profileId, staff.length]);

  if (!profileId) return null;

  return (
    <View style={[styles.wrap, { borderColor: palette.divider, backgroundColor: palette.card }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>Staff & RBAC</Text>
        <Text style={{ color: palette.subtext }}>{summary}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={palette.primaryStrong} />
      ) : (
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          {staff.map((entry) => {
            const form = formState[entry.id] ?? { role: entry.role || '', scope: entry.scope ? String(entry.scope) : '', shiftNote: '' };
            return (
              <View
                key={entry.id}
                style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.surface }]}
              >
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  {entry.user?.display_name || entry.role || 'Staff member'}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  Role: {entry.role} · On call: {entry.is_on_call ? 'Yes' : 'No'}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  Scope: {String(entry.scope ?? '—')}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  Licenses: {entry.licenses?.length ?? 0}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>
                  Shifts: {Array.isArray(entry.shifts) ? entry.shifts.length : 0}
                </Text>

                <View style={styles.formRow}>
                  <TextInput
                    value={form.role}
                    onChangeText={(value) => handleChange(entry.id, 'role', value)}
                    placeholder="Role"
                    placeholderTextColor={palette.subtext}
                    style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
                  />
                  <TextInput
                    value={form.scope}
                    onChangeText={(value) => handleChange(entry.id, 'scope', value)}
                    placeholder="Scope"
                    placeholderTextColor={palette.subtext}
                    style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
                  />
                </View>

                <View style={styles.buttonRow}>
                  <KISButton
                    title={updatingId === entry.id ? 'Saving…' : 'Save role'}
                    size="xs"
                    variant="primary"
                    onPress={() => onUpdateRole(entry.id, { role: form.role, scope: form.scope })}
                    disabled={updatingId === entry.id}
                  />
                  <KISButton
                    title={shiftLoadingId === entry.id ? 'Updating shifts…' : 'Assign shift'}
                    size="xs"
                    variant="secondary"
                    onPress={() =>
                      onAssignShift(entry.id, [
                        {
                          label: form.shiftNote || `Shift ${new Date().toISOString()}`,
                          starts_at: new Date().toISOString(),
                        },
                      ])
                    }
                    disabled={shiftLoadingId === entry.id}
                  />
                </View>
                <TextInput
                  value={form.shiftNote}
                  onChangeText={(value) => handleChange(entry.id, 'shiftNote', value)}
                  placeholder="Shift note"
                  placeholderTextColor={palette.subtext}
                  style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
                />
                {Array.isArray(entry.permissions) && entry.permissions.length > 0 && (
                  <View style={styles.tagsRow}>
                    {entry.permissions.slice(0, 3).map((perm: string) => (
                      <View key={perm} style={[styles.tag, { borderColor: palette.divider }]}>
                        <Text style={{ color: palette.subtext, fontSize: 11 }}>{perm}</Text>
                      </View>
                    ))}
                    {entry.permissions.length > 3 && (
                      <Text style={{ color: palette.subtext, fontSize: 11 }}>+{entry.permissions.length - 3} more</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
          {staff.length === 0 && (
            <Text style={{ color: palette.subtext, fontSize: 12 }}>No staff members yet. Use the profile manager to add clinicians.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (tokens: typeof KIS_TOKENS) =>
  StyleSheet.create({
    wrap: {
      borderWidth: 2,
      borderRadius: tokens.radius.xl,
      padding: tokens.spacing.lg,
      marginHorizontal: tokens.spacing.lg,
      gap: tokens.spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 16,
      fontWeight: '900',
    },
    card: {
      borderWidth: 2,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.sm,
      gap: tokens.spacing.xs,
    },
    cardTitle: {
      fontWeight: '900',
      fontSize: 15,
    },
    formRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
    },
    input: {
      flex: 1,
      borderWidth: 2,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontWeight: '700',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: tokens.spacing.xs,
    },
    tag: {
      borderWidth: 2,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
  });
