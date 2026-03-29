// src/screens/tabs/Filters.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Platform,
  Modal,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import {
  styles,
  type CustomFilter,
  type CustomFilterRule,
} from '../../Module/ChatRoom/messagesUtils';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import { KIS_TOKENS } from '@/theme/constants';

/* ----------------------------- Chips component ---------------------------- */
export function ToggleChip({
  label,
  active,
  onPress,
  palette,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  palette: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? palette.primarySoft : pressed ? palette.surface : palette.card,
          borderColor: active ? palette.primary : palette.inputBorder,
        },
      ]}
    >
      <Text style={{ color: active ? palette.primaryStrong : palette.text, fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ------------------------- Little checkbox & field UI --------------------- */

function Checkbox({
  checked,
  onToggle,
  palette,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  palette: any;
  label?: string;
}) {
  return (
    <Pressable onPress={onToggle} style={[styles.checkboxRow]}>
      <View
        style={[
          styles.checkboxBox,
          {
            borderColor: palette.inputBorder,
            backgroundColor: checked ? palette.primarySoft : palette.card,
          },
        ]}
      >
        {checked ? <KISIcon name="check" size={18} color={palette.text} /> : null}
      </View>
      {label ? <Text style={{ color: palette.text, fontSize: 14 }}>{label}</Text> : null}
    </Pressable>
  );
}

/* --------------------------- Custom Filter Manager ------------------------ */

export function FilterManager({
  visible,
  onClose,
  onSave,
  onDelete,
  filters,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (filter: CustomFilter) => void;
  onDelete: (id: string) => void;
  filters: CustomFilter[];
}) {
  const { palette } = useKISTheme();

  const [label, setLabel] = useState('');
  const [rules, setRules] = useState<CustomFilterRule>({
    name: '',
    includeDMs: undefined,
    includeGroups: undefined,
    onlyUnread: false,
    onlyMentions: false,
    withMedia: false,
    minUnread: undefined,
    participantIncludes: '',
    nameIncludes: '',
  });

  useEffect(() => {
    if (visible) {
      setLabel('');
      setRules({
        name: '',
        includeDMs: undefined,
        includeGroups: undefined,
        onlyUnread: false,
        onlyMentions: false,
        withMedia: false,
        minUnread: undefined,
        participantIncludes: '',
        nameIncludes: '',
      });
    }
  }, [visible]);

  function save() {
    const cleanLabel = label.trim();
    if (!cleanLabel) {
      Alert.alert('Name required', 'Please give your filter a name.');
      return;
    }
    const id = `cf_${Date.now()}`;
    onSave({ id, label: cleanLabel, rules: { ...rules, name: cleanLabel } });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={[styles.modalWrap, { backgroundColor: palette.backdrop }]}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: palette.card,
              borderColor: palette.inputBorder,
              shadowColor: palette.shadow,
            },
            KIS_TOKENS.elevation.popover,
          ]}
        >
          <Text style={[styles.modalTitle, { color: palette.text }]}>Create custom filter</Text>

          {/* Name */}
          <Text style={{ color: palette.subtext, marginBottom: 6 }}>Filter name</Text>
          <View
            style={[
              styles.input,
              { borderColor: palette.inputBorder, backgroundColor: palette.surfaceElevated },
            ]}
          >
            <TextInput
              placeholder="e.g. Media & Mentions"
              placeholderTextColor={palette.subtext}
              style={{ color: palette.text, fontSize: 14 }}
              value={label}
              onChangeText={setLabel}
            />
          </View>

          {/* Toggles */}
          <Checkbox
            label="Only unread"
            checked={!!rules.onlyUnread}
            onToggle={() => setRules((r) => ({ ...r, onlyUnread: !r.onlyUnread }))}
            palette={palette}
          />
          <Checkbox
            label="Only @mentions"
            checked={!!rules.onlyMentions}
            onToggle={() => setRules((r) => ({ ...r, onlyMentions: !r.onlyMentions }))}
            palette={palette}
          />
          <Checkbox
            label="With media"
            checked={!!rules.withMedia}
            onToggle={() => setRules((r) => ({ ...r, withMedia: !r.withMedia }))}
            palette={palette}
          />

          {/* Mutually exclusive scopers */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
            <Pressable
              onPress={() =>
                setRules((r) => ({
                  ...r,
                  includeGroups: r.includeGroups ? undefined : true,
                  includeDMs: undefined,
                }))
              }
              style={[
                styles.pillBtn,
                {
                  borderColor: palette.inputBorder,
                  backgroundColor: rules.includeGroups ? palette.primarySoft : palette.card,
                },
              ]}
            >
              <Text style={{ color: palette.text }}>Groups only</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setRules((r) => ({
                  ...r,
                  includeDMs: r.includeDMs ? undefined : true,
                  includeGroups: undefined,
                }))
              }
              style={[
                styles.pillBtn,
                {
                  borderColor: palette.inputBorder,
                  backgroundColor: rules.includeDMs ? palette.primarySoft : palette.card,
                },
              ]}
            >
              <Text style={{ color: palette.text }}>DMs only</Text>
            </Pressable>
          </View>

          {/* Min unread */}
          <Text style={{ color: palette.subtext, marginTop: 12, marginBottom: 6 }}>
            Minimum unread (optional)
          </Text>
          <View
            style={[
              styles.input,
              { borderColor: palette.inputBorder, backgroundColor: palette.surfaceElevated },
            ]}
          >
            <TextInput
              placeholder="e.g. 3"
              placeholderTextColor={palette.subtext}
              keyboardType="number-pad"
              style={{ color: palette.text, fontSize: 14 }}
              value={rules.minUnread?.toString() ?? ''}
              onChangeText={(t) =>
                setRules((r) => ({
                  ...r,
                  minUnread: t.trim() === '' ? undefined : Math.max(0, parseInt(t || '0', 10) || 0),
                }))
              }
            />
          </View>

          {/* Contains participant / name */}
          <Text style={{ color: palette.subtext, marginTop: 12, marginBottom: 6 }}>
            Participant contains (optional)
          </Text>
          <View
            style={[
              styles.input,
              { borderColor: palette.inputBorder, backgroundColor: palette.surfaceElevated },
            ]}
          >
            <TextInput
              placeholder="e.g. anna"
              placeholderTextColor={palette.subtext}
              style={{ color: palette.text, fontSize: 14 }}
              value={rules.participantIncludes ?? ''}
              onChangeText={(t) => setRules((r) => ({ ...r, participantIncludes: t }))}
            />
          </View>

          <Text style={{ color: palette.subtext, marginTop: 12, marginBottom: 6 }}>
            Chat name contains (optional)
          </Text>
          <View
            style={[
              styles.input,
              { borderColor: palette.inputBorder, backgroundColor: palette.surfaceElevated },
            ]}
          >
            <TextInput
              placeholder="e.g. media"
              placeholderTextColor={palette.subtext}
              style={{ color: palette.text, fontSize: 14 }}
              value={rules.nameIncludes ?? ''}
              onChangeText={(t) => setRules((r) => ({ ...r, nameIncludes: t }))}
            />
          </View>

          {/* Existing filters list */}
          {filters.length > 0 ? (
            <>
              <Text style={{ color: palette.subtext, marginTop: 16, marginBottom: 8 }}>
                Your saved filters
              </Text>
              <View style={{ gap: 8, flexWrap: 'wrap', flexDirection: 'row' }}>
                {filters.map((f) => (
                  <View
                    key={f.id}
                    style={[
                      styles.savedFilterPill,
                      { borderColor: palette.inputBorder, backgroundColor: palette.card },
                    ]}
                  >
                    <Text style={{ color: palette.text }}>{f.label}</Text>
                    <Pressable
                      onPress={() => onDelete(f.id)}
                      hitSlop={8}
                      style={{ marginLeft: 8, paddingHorizontal: 4, paddingVertical: 2 }}
                    >
                      <KISIcon name="trash" size={18} color={palette.text} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* Footer buttons */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <Pressable onPress={onClose} style={[styles.footerBtn, { backgroundColor: palette.surface }]}>
              <Text style={{ color: palette.text }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              style={[styles.footerBtn, { backgroundColor: palette.primarySoft, borderWidth: 2, borderColor: palette.primary }]}
            >
              <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>Save filter</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
