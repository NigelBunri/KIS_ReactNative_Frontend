// src/components/partners/forms/AutomationActionsForm.tsx
//
// Each automation action has a fixed, known shape on the backend
// (apps/partners/services.py's _apply_automation_actions) — there is no
// such thing as an arbitrary action type or arbitrary params, so editing
// them through a raw key/value box was never actually correct, just
// undiscoverable and error-prone (a typo'd key silently does nothing).
// This renders the real field set per action type instead.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import styles from '@/components/partners/partnersStyles';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

export type ActionType = 'assign_role' | 'remove_role' | 'set_feature_flag' | 'dispatch_webhook' | 'log_audit';

export type ActionRow = {
  type: ActionType | '';
  params: Record<string, any>;
};

type PartnerRoleOption = { id: string; name: string };
type MemberOption = { user_id: string; display_name?: string | null; username?: string | null };

const ACTION_TYPES: { value: ActionType; label: string; description: string }[] = [
  { value: 'assign_role', label: 'Assign role', description: 'Grant a partner role to a member.' },
  { value: 'remove_role', label: 'Remove role', description: 'Revoke a partner role from a member.' },
  { value: 'set_feature_flag', label: 'Set feature flag', description: 'Turn a setting on or off for this organization.' },
  { value: 'dispatch_webhook', label: 'Dispatch webhook', description: 'Notify your configured webhooks.' },
  { value: 'log_audit', label: 'Log audit entry', description: 'Record a custom entry in the audit log.' },
];

function ChipPicker({
  palette, options, value, onSelect, getLabel, getKey,
}: {
  palette: any;
  options: any[];
  value: string | null | undefined;
  onSelect: (val: string) => void;
  getLabel: (opt: any) => string;
  getKey: (opt: any) => string;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {options.map((opt) => {
        const key = getKey(opt);
        const selected = String(value) === String(key);
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            style={{
              paddingVertical: 5,
              paddingHorizontal: 10,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: selected ? palette.primary : palette.borderMuted,
            }}
          >
            <Text style={{ color: selected ? palette.primary : palette.text, fontSize: 12 }}>{getLabel(opt)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LabeledInput({
  palette, label, ...inputProps
}: { palette: any; label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>{label}</Text>
      <TextInput
        placeholderTextColor={palette.subtext}
        style={{
          color: palette.text,
          borderColor: palette.borderMuted,
          borderWidth: 2,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
        }}
        {...inputProps}
      />
    </View>
  );
}

type Props = {
  palette: any;
  partnerId?: string | null;
  actions: ActionRow[];
  onChange: (actions: ActionRow[]) => void;
};

export default function AutomationActionsForm({ palette, partnerId, actions, onChange }: Props) {
  const [roles, setRoles] = useState<PartnerRoleOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);

  const loadRoles = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.roles(partnerId), { errorMessage: 'Unable to load roles.' });
    const list = (res?.data ?? res ?? []) as PartnerRoleOption[];
    setRoles(Array.isArray(list) ? list : []);
  }, [partnerId]);

  const loadMembers = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(`${ROUTES.partners.members(partnerId)}?page=1`, { errorMessage: 'Unable to load members.' });
    const payload = res?.data ?? res ?? {};
    const results = (payload.results ?? payload.members ?? []) as MemberOption[];
    setMembers(Array.isArray(results) ? results : []);
  }, [partnerId]);

  useEffect(() => {
    loadRoles();
    loadMembers();
  }, [loadRoles, loadMembers]);

  const updateAction = (index: number, next: Partial<ActionRow>) => {
    onChange(actions.map((row, rowIndex) => (rowIndex === index ? { ...row, ...next } : row)));
  };

  const updateParams = (index: number, paramPatch: Record<string, any>) => {
    const current = actions[index]?.params || {};
    updateAction(index, { params: { ...current, ...paramPatch } });
  };

  const addAction = () => {
    onChange([...actions, { type: '', params: {} }]);
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, rowIndex) => rowIndex !== index));
  };

  const memberLabel = (m: MemberOption) => m.display_name || m.username || 'Member';

  return (
    <View>
      <Text style={[styles.settingsFeatureTitle, { color: palette.text, marginTop: 12 }]}>Actions</Text>
      {actions.map((action, index) => {
        const params = action.params || {};
        return (
          <View
            key={`action-${index}`}
            style={[
              styles.settingsFeatureRow,
              { borderColor: palette.borderMuted, backgroundColor: palette.surface, marginTop: 8 },
            ]}
          >
            <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
              What should happen
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {ACTION_TYPES.map((opt) => {
                const selected = action.type === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => updateAction(index, { type: opt.value, params: {} })}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: selected ? palette.primary : palette.borderMuted,
                      backgroundColor: selected ? (palette.primarySoft ?? palette.surface) : 'transparent',
                    }}
                  >
                    <Text style={{ color: selected ? palette.primary : palette.text, fontSize: 12, fontWeight: '600' }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {action.type ? (
              <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
                {ACTION_TYPES.find((o) => o.value === action.type)?.description}
              </Text>
            ) : null}

            {(action.type === 'assign_role' || action.type === 'remove_role') && (
              <>
                <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 4 }}>
                  Role
                </Text>
                <ChipPicker
                  palette={palette}
                  options={roles}
                  value={params.role_id}
                  onSelect={(id) => updateParams(index, { role_id: id })}
                  getLabel={(r) => r.name}
                  getKey={(r) => String(r.id)}
                />
                <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 4 }}>
                  Member (leave unset to use whoever triggered the rule)
                </Text>
                <ChipPicker
                  palette={palette}
                  options={members}
                  value={params.user_id}
                  onSelect={(id) => updateParams(index, { user_id: params.user_id === id ? undefined : id })}
                  getLabel={memberLabel}
                  getKey={(m) => m.user_id}
                />
              </>
            )}

            {action.type === 'set_feature_flag' && (
              <>
                <LabeledInput
                  palette={palette}
                  label="Setting key"
                  value={params.key || ''}
                  onChangeText={(v) => updateParams(index, { key: v })}
                  placeholder="e.g. task_management"
                  autoCapitalize="none"
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                  <Text style={{ color: palette.text, fontSize: 13, fontWeight: '600' }}>Enabled</Text>
                  <Switch
                    value={params.enabled !== false}
                    onValueChange={(v) => updateParams(index, { enabled: v })}
                  />
                </View>
              </>
            )}

            {action.type === 'dispatch_webhook' && (
              <LabeledInput
                palette={palette}
                label="Event name sent to your webhooks"
                value={params.event || ''}
                onChangeText={(v) => updateParams(index, { event: v })}
                placeholder="automation.triggered"
                autoCapitalize="none"
              />
            )}

            {action.type === 'log_audit' && (
              <>
                <LabeledInput
                  palette={palette}
                  label="Audit action label"
                  value={params.action || ''}
                  onChangeText={(v) => updateParams(index, { action: v })}
                  placeholder="e.g. partner.automation.run"
                  autoCapitalize="none"
                />
                <LabeledInput
                  palette={palette}
                  label="Target type"
                  value={params.target_type || ''}
                  onChangeText={(v) => updateParams(index, { target_type: v })}
                  placeholder="e.g. partner_automation_rule"
                  autoCapitalize="none"
                />
              </>
            )}

            <Pressable
              onPress={() => removeAction(index)}
              style={({ pressed }) => [
                {
                  marginTop: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: palette.borderMuted,
                  opacity: pressed ? 0.8 : 1,
                  alignItems: 'center',
                },
              ]}
            >
              <Text style={{ color: palette.text, fontWeight: '700' }}>REMOVE ACTION</Text>
            </Pressable>
          </View>
        );
      })}
      <Pressable
        onPress={addAction}
        style={({ pressed }) => [
          {
            marginTop: 8,
            paddingVertical: 6,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: palette.borderMuted,
            backgroundColor: palette.primarySoft ?? palette.surface,
            opacity: pressed ? 0.8 : 1,
            alignItems: 'center',
          },
        ]}
      >
        <Text style={{ color: palette.primaryStrong ?? palette.text, fontWeight: '700' }}>ADD ACTION</Text>
      </Pressable>
    </View>
  );
}
