import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import AutomationConditionsForm, { type ConditionRow } from '@/components/partners/forms/AutomationConditionsForm';
import AutomationActionsForm, { type ActionRow } from '@/components/partners/forms/AutomationActionsForm';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

type AutomationRule = {
  id: string | number;
  name: string;
  description?: string;
  trigger: string;
  conditions?: Record<string, any>;
  actions?: Array<Record<string, any>>;
  is_active?: boolean;
  last_run_at?: string | null;
  last_run_status?: string | null;
};

const DEFAULT_TRIGGER = 'member.joined';

export default function PartnerAutomationPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  partnerId,
  onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState(DEFAULT_TRIGGER);
  const [conditions, setConditions] = useState<ConditionRow[]>([
    { field: '', op: 'eq', value: '' },
  ]);
  const [actions, setActions] = useState<ActionRow[]>([
    { type: '', params: [{ key: '', value: '' }] },
  ]);

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const loadRules = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.automationRules(partnerId), {
      errorMessage: 'Unable to load automation rules.',
    });
    const list = (res?.data ?? res ?? []) as AutomationRule[];
    setRules(Array.isArray(list) ? list : []);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    loadRules().finally(() => setLoading(false));
  }, [isOpen, loadRules]);

  const coerceValue = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') return '';
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber) && trimmed === String(asNumber)) {
      return asNumber;
    }
    return trimmed;
  };

  const onCreateRule = async () => {
    if (!partnerId) return;
    if (!name.trim() || !trigger.trim()) {
      Alert.alert('Missing info', 'Name and trigger are required.');
      return;
    }
    const conditionList = conditions
      .filter((condition) => condition.field.trim())
      .map((condition) => {
        const op = condition.op.trim() || 'eq';
        let value: any = coerceValue(condition.value);
        if (op === 'in') {
          value = condition.value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        }
        return { field: condition.field.trim(), op, value };
      });
    const conditionsObj = conditionList.length ? { all: conditionList } : {};

    const actionsObj = actions
      .filter((action) => action.type.trim())
      .map((action) => {
        const params: Record<string, any> = {};
        action.params.forEach((param) => {
          if (!param.key.trim()) return;
          params[param.key.trim()] = coerceValue(param.value);
        });
        return {
          type: action.type.trim(),
          params,
        };
      });
    if (!actionsObj.length) {
      Alert.alert('Missing actions', 'Add at least one action.');
      return;
    }
    const res = await postRequest(ROUTES.partners.automationRules(partnerId), {
      name: name.trim(),
      trigger: trigger.trim(),
      conditions: conditionsObj,
      actions: actionsObj,
      is_active: true,
    });
    if (!res?.success) {
      Alert.alert('Create failed', res?.message ?? 'Unable to create rule.');
      return;
    }
    setName('');
    setTrigger(DEFAULT_TRIGGER);
    setConditions([{ field: '', op: 'eq', value: '' }]);
    setActions([{ type: '', params: [{ key: '', value: '' }] }]);
    loadRules();
  };

  const toggleRule = async (rule: AutomationRule, value: boolean) => {
    if (!partnerId) return;
    const res = await patchRequest(
      ROUTES.partners.automationRuleUpdate(partnerId, String(rule.id)),
      { is_active: value },
      { errorMessage: 'Unable to update rule.' },
    );
    if (!res?.success) {
      Alert.alert('Update failed', res?.message ?? 'Please try again.');
      return;
    }
    setRules((prev) =>
      prev.map((item) =>
        item.id === rule.id ? { ...item, is_active: value } : item,
      ),
    );
  };

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
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              Automation Rules
            </Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              Trigger actions when partner events happen.
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
          ) : (
            <>
              <View
                style={[
                  styles.settingsFeatureRow,
                  { borderColor: palette.borderMuted, backgroundColor: palette.surface },
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  Create rule
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Rule name"
                  placeholderTextColor={palette.subtext}
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <TextInput
                  value={trigger}
                  onChangeText={setTrigger}
                  placeholder="Trigger event (e.g. member.joined)"
                  placeholderTextColor={palette.subtext}
                  style={{
                    color: palette.text,
                    borderColor: palette.borderMuted,
                    borderWidth: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
                <AutomationConditionsForm
                  palette={palette}
                  conditions={conditions}
                  onChange={setConditions}
                />
                <AutomationActionsForm
                  palette={palette}
                  actions={actions}
                  onChange={setActions}
                />
                <Pressable
                  onPress={onCreateRule}
                  style={({ pressed }) => [
                    {
                      marginTop: 10,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: palette.borderMuted,
                      backgroundColor: palette.primarySoft ?? palette.surface,
                      opacity: pressed ? 0.8 : 1,
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Text style={{ color: palette.primaryStrong ?? palette.text, fontWeight: '700' }}>
                    ADD RULE
                  </Text>
                </Pressable>
              </View>

              {rules.map((rule) => (
                <View
                  key={String(rule.id)}
                  style={[
                    styles.settingsFeatureRow,
                    { borderColor: palette.borderMuted, backgroundColor: palette.surface },
                  ]}
                >
                  <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                    {rule.name}
                  </Text>
                  <Text style={[styles.settingsFeatureDescription, { color: palette.subtext }]}>
                    Trigger: {rule.trigger}
                  </Text>
                  <Text style={[styles.settingsFeatureMeta, { color: palette.subtext }]}>
                    Last run: {rule.last_run_status || 'never'}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Switch
                      value={Boolean(rule.is_active)}
                      onValueChange={(value) => toggleRule(rule, value)}
                    />
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
