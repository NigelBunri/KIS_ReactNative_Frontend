// src/screens/bots/WorkflowBuilderScreen.tsx
// No-code workflow builder (Phase 2) — create or edit a DRAFT/PAUSED
// workflow's trigger, conditions and actions as plain forms/pickers, no
// code required. Every field here maps directly onto the declarative
// JSON apps.bots.workflow_engine validates server-side; nothing here
// executes anything — publishing/activating happens on WorkflowDetail.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';

type Grant = { id: string; resource_type: string; resource_id: string };

type Rule = { field: string; op: string; value: string };
type ActionRow = { type: string; text?: string; body?: string; title?: string; userId?: string; action?: string; detailsJson?: string; delaySeconds?: string };

const TRIGGER_OPTIONS = [
  { key: 'message.created', label: 'New message', hint: 'Fires whenever a new message is sent in the connected resource.' },
  { key: 'message.edited', label: 'Message edited', hint: 'Fires whenever a message in the connected resource is edited.' },
  { key: 'member.joined', label: 'Member joined', hint: 'Fires when someone joins the connected group, community, partner org or channel.' },
  { key: 'member.left', label: 'Member left', hint: 'Fires when someone leaves, is removed, or is banned.' },
  { key: 'post.created', label: 'New post', hint: 'Fires when a new post is published in the connected channel, community, partner feed or your own feed.' },
  { key: 'comment.created', label: 'New comment', hint: 'Fires when a new comment is added to a post in the connected community or partner org.' },
  { key: 'schedule', label: 'Scheduled', hint: 'Fires automatically on a schedule you choose.' },
];

const FIELD_SUGGESTIONS: Record<string, string[]> = {
  'message.created': ['message.text', 'sender.id', 'received_at'],
  'message.edited': ['message.text', 'sender.id', 'received_at'],
  'member.joined': ['member.id', 'received_at'],
  'member.left': ['member.id', 'received_at'],
  'post.created': ['post.title', 'post.text', 'author.id', 'received_at'],
  'comment.created': ['comment.text', 'post.id', 'author.id', 'received_at'],
  schedule: ['schedule.ran_at', 'received_at'],
};

const OP_OPTIONS = [
  'equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with',
  'gt', 'lt', 'gte', 'lte', 'is_empty', 'is_not_empty', 'before', 'after',
  'within_last_minutes', 'within_last_hours',
];
const OPS_WITHOUT_VALUE = new Set(['is_empty', 'is_not_empty']);
const ACTION_TYPES = [
  { key: 'send_message', label: 'Send a message' },
  { key: 'send_notification', label: 'Send a notification' },
  { key: 'execute_action', label: 'Perform a moderation action' },
];
const MODERATION_ACTION_SUGGESTIONS = ['ban_member', 'unban_member', 'remove_member', 'mute_member', 'unmute_member'];
const COMMON_TIMEZONES = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Africa/Lagos', 'Africa/Douala', 'Asia/Dubai'];

function Chip({ label, selected, onPress, palette }: { label: string; selected: boolean; onPress: () => void; palette: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
        borderWidth: 1.5, borderColor: selected ? palette.primaryStrong : palette.divider,
        backgroundColor: selected ? palette.primarySoft : 'transparent',
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: selected ? palette.primaryStrong : palette.subtext }}>{label}</Text>
    </Pressable>
  );
}

function RuleEditor({
  rule, onChange, onRemove, suggestions, palette,
}: { rule: Rule; onChange: (r: Rule) => void; onRemove: () => void; suggestions: string[]; palette: any }) {
  return (
    <View style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 14, padding: 10, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: palette.text }}>If this field…</Text>
        <Pressable onPress={onRemove} hitSlop={8}>
          <KISIcon name="close" size={16} color={palette.danger} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {suggestions.map((s) => (
          <Chip key={s} label={s} selected={rule.field === s} onPress={() => onChange({ ...rule, field: s })} palette={palette} />
        ))}
      </View>
      <KISTextInput value={rule.field} onChangeText={(v) => onChange({ ...rule, field: v })} placeholder="field (e.g. message.text)" autoCapitalize="none" />
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {OP_OPTIONS.map((op) => (
          <Chip key={op} label={op.replace(/_/g, ' ')} selected={rule.op === op} onPress={() => onChange({ ...rule, op })} palette={palette} />
        ))}
      </View>
      {!OPS_WITHOUT_VALUE.has(rule.op) ? (
        <KISTextInput
          value={rule.value}
          onChangeText={(v) => onChange({ ...rule, value: v })}
          placeholder={valuePlaceholderForOp(rule.op)}
          autoCapitalize="none"
        />
      ) : (
        <Text style={{ fontSize: 11, color: palette.subtext }}>
          No value needed — this checks whether the field itself is {rule.op === 'is_empty' ? 'empty' : 'not empty'}.
        </Text>
      )}
    </View>
  );
}

function valuePlaceholderForOp(op: string): string {
  if (op === 'within_last_minutes') return 'number of minutes (e.g. 15)';
  if (op === 'within_last_hours') return 'number of hours (e.g. 2)';
  if (op === 'before' || op === 'after') return 'ISO date/time (e.g. 2026-11-04T09:00:00Z)';
  if (op === 'gt' || op === 'lt' || op === 'gte' || op === 'lte') return 'a number';
  if (op === 'in' || op === 'not_in') return 'comma-separated values';
  return 'value to compare against';
}

function ActionEditor({
  action, onChange, onRemove, palette,
}: { action: ActionRow; onChange: (a: ActionRow) => void; onRemove: () => void; palette: any }) {
  return (
    <View style={{ borderWidth: 1, borderColor: palette.divider, borderRadius: 14, padding: 10, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: palette.text }}>Then…</Text>
        <Pressable onPress={onRemove} hitSlop={8}>
          <KISIcon name="close" size={16} color={palette.danger} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {ACTION_TYPES.map((t) => (
          <Chip key={t.key} label={t.label} selected={action.type === t.key} onPress={() => onChange({ ...action, type: t.key })} palette={palette} />
        ))}
      </View>
      {action.type === 'send_message' ? (
        <KISTextInput
          value={action.text ?? ''} onChangeText={(v) => onChange({ ...action, text: v })}
          placeholder="Message text to send" multiline layout={{ multilineMinHeight: 60 }}
        />
      ) : null}
      {action.type === 'send_notification' ? (
        <>
          <KISTextInput value={action.title ?? ''} onChangeText={(v) => onChange({ ...action, title: v })} placeholder="Notification title (optional)" />
          <KISTextInput value={action.body ?? ''} onChangeText={(v) => onChange({ ...action, body: v })} placeholder="Notification text" multiline layout={{ multilineMinHeight: 50 }} />
          <KISTextInput value={action.userId ?? ''} onChangeText={(v) => onChange({ ...action, userId: v })} placeholder="User ID (leave blank to notify the triggering user)" autoCapitalize="none" />
        </>
      ) : null}
      {action.type === 'execute_action' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {MODERATION_ACTION_SUGGESTIONS.map((a) => (
              <Chip key={a} label={a.replace(/_/g, ' ')} selected={action.action === a} onPress={() => onChange({ ...action, action: a })} palette={palette} />
            ))}
          </View>
          <KISTextInput value={action.action ?? ''} onChangeText={(v) => onChange({ ...action, action: v })} placeholder="Action name (e.g. ban_member)" autoCapitalize="none" />
          <KISTextInput
            value={action.detailsJson ?? ''} onChangeText={(v) => onChange({ ...action, detailsJson: v })}
            placeholder='Details as JSON (e.g. {"user_id": "..."})' autoCapitalize="none" multiline layout={{ multilineMinHeight: 50 }}
          />
          <Text style={{ fontSize: 11, color: palette.subtext }}>
            Restrictive actions (ban/remove/mute) will need your approval each time, unless this resource's connection has pre-approved them. Reversing ones (unban/unmute) run immediately.
          </Text>
        </>
      ) : null}
      <KISTextInput
        value={action.delaySeconds ?? ''} onChangeText={(v) => onChange({ ...action, delaySeconds: v.replace(/[^0-9]/g, '') })}
        placeholder="Delay before running (seconds, optional)" keyboardType="number-pad"
      />
    </View>
  );
}

export default function WorkflowBuilderScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const botId: string = route.params?.botId;
  const workflowId: string | undefined = route.params?.workflowId;
  const isEdit = !!workflowId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [resourceGrantId, setResourceGrantId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('message.created');
  const [scheduleMode, setScheduleMode] = useState<'interval' | 'cron'>('interval');
  const [intervalMinutes, setIntervalMinutes] = useState('60');
  const [cronExpression, setCronExpression] = useState('0 9 * * *');
  const [scheduleTimezone, setScheduleTimezone] = useState('UTC');
  const [conditionOp, setConditionOp] = useState<'AND' | 'OR'>('AND');
  const [rules, setRules] = useState<Rule[]>([]);
  const [thenActions, setThenActions] = useState<ActionRow[]>([{ type: 'send_message', text: '' }]);
  const [elseActions, setElseActions] = useState<ActionRow[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await getRequest(ROUTES.bots.resourceGrants(botId));
      if (res?.success) setGrants(Array.isArray(res.data) ? res.data : []);
    })();
  }, [botId]);

  useFocusEffect(useCallback(() => {
    if (!isEdit) return;
    void (async () => {
      setLoading(true);
      const res = await getRequest(ROUTES.bots.workflowDetail(botId, workflowId!), { forceNetwork: true });
      if (res?.success) {
        const w = res.data;
        setResourceGrantId(w.resource_grant_id);
        setName(w.name);
        setDescription(w.description ?? '');
        setTriggerType(w.trigger_type);
        if (w.trigger_config?.cron) {
          setScheduleMode('cron');
          setCronExpression(w.trigger_config.cron);
        } else {
          setScheduleMode('interval');
          setIntervalMinutes(String(w.trigger_config?.interval_minutes ?? 60));
        }
        setScheduleTimezone(w.trigger_config?.timezone ?? 'UTC');
        setConditionOp(w.definition?.conditions?.op ?? 'AND');
        setRules((w.definition?.conditions?.rules ?? []).map((r: any) => ({ field: r.field, op: r.op, value: String(r.value) })));
        setThenActions(actionsFromServer(w.definition?.then_actions ?? []));
        setElseActions(actionsFromServer(w.definition?.else_actions ?? []));
      }
      setLoading(false);
    })();
  }, [isEdit, botId, workflowId]));

  const addRule = () => setRules((prev) => [...prev, { field: '', op: 'contains', value: '' }]);
  const addAction = (setter: typeof setThenActions) => setter((prev) => [...prev, { type: 'send_message', text: '' }]);

  const buildDefinition = () => ({
    conditions: rules.length
      ? { op: conditionOp, rules: rules.filter((r) => r.field && (OPS_WITHOUT_VALUE.has(r.op) || r.value)) }
      : {},
    then_actions: thenActions.map(actionToServer).filter(Boolean),
    else_actions: elseActions.map(actionToServer).filter(Boolean),
  });

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your workflow a name.');
      return;
    }
    if (!isEdit && !resourceGrantId) {
      Alert.alert('Resource required', 'Choose which connected resource this workflow should run against.');
      return;
    }
    setSaving(true);
    const definition = buildDefinition();
    let triggerConfig: Record<string, any> = {};
    if (triggerType === 'schedule') {
      triggerConfig = scheduleMode === 'cron'
        ? { cron: cronExpression.trim(), timezone: scheduleTimezone }
        : { interval_minutes: parseInt(intervalMinutes || '60', 10), timezone: scheduleTimezone };
    }
    let res;
    if (isEdit) {
      res = await patchRequest(ROUTES.bots.workflowDetail(botId, workflowId!), {
        name: name.trim(), description, trigger_type: triggerType, trigger_config: triggerConfig, definition,
      });
    } else {
      res = await postRequest(ROUTES.bots.workflows(botId), {
        resource_grant_id: resourceGrantId, name: name.trim(), description,
        trigger_type: triggerType, trigger_config: triggerConfig, definition,
      });
    }
    setSaving(false);
    if (res?.success) {
      const savedId = isEdit ? workflowId : res.data.id;
      navigation.replace('WorkflowDetail', { botId, workflowId: savedId, name: name.trim() });
    } else {
      Alert.alert('Could not save workflow', res?.message || 'Please check your fields and try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: palette.subtext }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: responsive.pageGutter,
          paddingTop: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: palette.divider,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={{ padding: 4 }}>
          <KISIcon name="close" size={20} color={palette.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '900', color: palette.text }}>
          {isEdit ? 'Edit workflow' : 'New workflow'}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: responsive.pageGutter, gap: responsive.cardGap, paddingBottom: 40 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text }}>Workflow name</Text>
          <KISTextInput value={name} onChangeText={setName} placeholder="e.g. Welcome new members" maxLength={160} />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text }}>Description (optional)</Text>
          <KISTextInput value={description} onChangeText={setDescription} placeholder="What does this workflow do?" multiline layout={{ multilineMinHeight: 60 }} />
        </View>

        {!isEdit ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text }}>Which connected resource?</Text>
            {grants.length === 0 ? (
              <Text style={{ fontSize: 12, color: palette.subtext }}>
                Connect this bot to a Group, Channel, Community, Partner or feed first (from the bot's detail screen) before building a workflow.
              </Text>
            ) : (
              <View style={{ gap: 6 }}>
                {grants.map((g) => (
                  <Pressable
                    key={g.id}
                    onPress={() => setResourceGrantId(g.id)}
                    style={{
                      borderWidth: 2, borderRadius: 12, padding: 10,
                      borderColor: resourceGrantId === g.id ? palette.primaryStrong : palette.divider,
                      backgroundColor: resourceGrantId === g.id ? palette.primarySoft : palette.card,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>
                      {g.resource_type}: {g.resource_id.slice(0, 8)}…
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text }}>When should this run?</Text>
          {TRIGGER_OPTIONS.map((t) => {
            const selected = triggerType === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTriggerType(t.key)}
                style={{
                  borderWidth: 2, borderRadius: 14, padding: 12, gap: 4,
                  borderColor: selected ? palette.primaryStrong : palette.divider,
                  backgroundColor: selected ? palette.primarySoft : palette.card,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: palette.text }}>{t.label}</Text>
                <Text style={{ fontSize: 12, color: palette.subtext }}>{t.hint}</Text>
              </Pressable>
            );
          })}
          {triggerType === 'schedule' ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Chip label="Simple interval" selected={scheduleMode === 'interval'} onPress={() => setScheduleMode('interval')} palette={palette} />
                <Chip label="Specific times (cron)" selected={scheduleMode === 'cron'} onPress={() => setScheduleMode('cron')} palette={palette} />
              </View>
              {scheduleMode === 'interval' ? (
                <KISTextInput
                  value={intervalMinutes} onChangeText={(v) => setIntervalMinutes(v.replace(/[^0-9]/g, ''))}
                  placeholder="Repeat every how many minutes? (minimum 5)" keyboardType="number-pad"
                />
              ) : (
                <>
                  <KISTextInput
                    value={cronExpression} onChangeText={setCronExpression}
                    placeholder="minute hour day month weekday (e.g. 0 9 * * *)" autoCapitalize="none"
                  />
                  <Text style={{ fontSize: 11, color: palette.subtext }}>
                    "0 9 * * *" runs every day at 9:00. "0 9 * * 1-5" runs weekdays only at 9:00.
                  </Text>
                </>
              )}
              <Text style={{ fontSize: 12, fontWeight: '800', color: palette.text, marginTop: 4 }}>Timezone</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {COMMON_TIMEZONES.map((tz) => (
                  <Chip key={tz} label={tz} selected={scheduleTimezone === tz} onPress={() => setScheduleTimezone(tz)} palette={palette} />
                ))}
              </View>
              <KISTextInput value={scheduleTimezone} onChangeText={setScheduleTimezone} placeholder="IANA timezone (e.g. Africa/Lagos)" autoCapitalize="none" />
              <Text style={{ fontSize: 11, color: palette.subtext }}>
                This workflow will run at the time above in {scheduleTimezone || 'UTC'}, adjusting automatically for daylight saving where that timezone observes it.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text }}>Conditions (optional)</Text>
            {rules.length > 1 ? (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Chip label="Match ALL (AND)" selected={conditionOp === 'AND'} onPress={() => setConditionOp('AND')} palette={palette} />
                <Chip label="Match ANY (OR)" selected={conditionOp === 'OR'} onPress={() => setConditionOp('OR')} palette={palette} />
              </View>
            ) : null}
          </View>
          <Text style={{ fontSize: 12, color: palette.subtext }}>
            Leave empty to always run the actions below when triggered.
          </Text>
          {rules.map((rule, i) => (
            <RuleEditor
              key={i} rule={rule} suggestions={FIELD_SUGGESTIONS[triggerType] ?? []} palette={palette}
              onChange={(r) => setRules((prev) => prev.map((p, idx) => (idx === i ? r : p)))}
              onRemove={() => setRules((prev) => prev.filter((_, idx) => idx !== i))}
            />
          ))}
          <KISButton title="Add a condition" size="sm" variant="outline" onPress={addRule} />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text }}>
            {rules.length ? 'If true, do this' : 'Do this'}
          </Text>
          {thenActions.map((action, i) => (
            <ActionEditor
              key={i} action={action} palette={palette}
              onChange={(a) => setThenActions((prev) => prev.map((p, idx) => (idx === i ? a : p)))}
              onRemove={() => setThenActions((prev) => prev.filter((_, idx) => idx !== i))}
            />
          ))}
          <KISButton title="Add an action" size="sm" variant="outline" onPress={() => addAction(setThenActions)} />
        </View>

        {rules.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text }}>Otherwise, do this (optional)</Text>
            {elseActions.map((action, i) => (
              <ActionEditor
                key={i} action={action} palette={palette}
                onChange={(a) => setElseActions((prev) => prev.map((p, idx) => (idx === i ? a : p)))}
                onRemove={() => setElseActions((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
            <KISButton title="Add an else action" size="sm" variant="outline" onPress={() => addAction(setElseActions)} />
          </View>
        ) : null}

        <KISButton title={saving ? 'Saving…' : 'Save as draft'} onPress={handleSave} disabled={saving} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

function actionToServer(a: ActionRow): any {
  const delay = parseInt(a.delaySeconds || '0', 10) || 0;
  if (a.type === 'send_message') {
    if (!a.text?.trim()) return null;
    return { type: 'send_message', params: { text: a.text.trim() }, delay_seconds: delay };
  }
  if (a.type === 'send_notification') {
    if (!a.body?.trim()) return null;
    const params: any = { body: a.body.trim() };
    if (a.title?.trim()) params.title = a.title.trim();
    if (a.userId?.trim()) params.user_id = a.userId.trim();
    return { type: 'send_notification', params, delay_seconds: delay };
  }
  if (a.type === 'execute_action') {
    if (!a.action?.trim()) return null;
    let details = {};
    try {
      details = a.detailsJson ? JSON.parse(a.detailsJson) : {};
    } catch {
      details = {};
    }
    return { type: 'execute_action', params: { action: a.action.trim(), details }, delay_seconds: delay };
  }
  return null;
}

function actionsFromServer(actions: any[]): ActionRow[] {
  return (actions || []).map((a) => {
    const row: ActionRow = { type: a.type, delaySeconds: a.delay_seconds ? String(a.delay_seconds) : '' };
    if (a.type === 'send_message') row.text = a.params?.text ?? '';
    if (a.type === 'send_notification') {
      row.body = a.params?.body ?? '';
      row.title = a.params?.title ?? '';
      row.userId = a.params?.user_id ?? '';
    }
    if (a.type === 'execute_action') {
      row.action = a.params?.action ?? '';
      row.detailsJson = a.params?.details ? JSON.stringify(a.params.details) : '';
    }
    return row;
  });
}
