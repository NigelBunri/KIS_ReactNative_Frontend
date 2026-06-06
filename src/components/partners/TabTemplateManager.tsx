/**
 * TabTemplateManager — deep content management per tab template type.
 * Used inside AppBuilderPanel when a partner admin clicks "Manage content"
 * on a tab. Routes to the right specialized manager based on template.
 *
 * Templates:
 *   bible              → BibleTabManager (books, meditations, prayer config)
 *   broadcast          → BroadcastTabManager (post/announcement composer)
 *   dashboard          → DashboardWidgetManager (widget layout + KPI sources)
 *   messaging/workspace→ MessagingTabManager (channel + topic configuration)
 *   custom             → Generic content block editor (handled by AppBuilderPanel itself)
 *   partner_geolocation_attendance → Handled by LocationAttendanceTemplate
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import type { PartnerOrganizationAppTab } from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabTemplate =
  | 'bible'
  | 'broadcast'
  | 'dashboard'
  | 'messaging'
  | 'workspace'
  | 'partner'
  | 'profile'
  | 'custom'
  | 'partner_geolocation_attendance';

type Props = {
  tab: PartnerOrganizationAppTab;
  appId: string;
  partnerId: string;
  onBack: () => void;
};

// ─── Router ───────────────────────────────────────────────────────────────────

export default function TabTemplateManager({ tab, appId, partnerId, onBack }: Props) {
  const { palette } = useKISTheme();
  const cfg = (tab.config ?? {}) as Record<string, any>;
  const template: TabTemplate = cfg.template ?? 'custom';

  const headerTitle: Record<string, string> = {
    bible: '📖 Bible Content',
    broadcast: '📡 Posts & Announcements',
    dashboard: '📊 Dashboard Widgets',
    messaging: '💬 Messaging Configuration',
    workspace: '🏢 Workspace Configuration',
    partner: '🤝 Partner Configuration',
    custom: '✏️ Content Blocks',
    partner_geolocation_attendance: '📍 Attendance Configuration',
    profile: '👤 Profile',
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={{ color: palette.primary, fontSize: 28, lineHeight: 32, fontWeight: '300' }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>{headerTitle[template] ?? 'Manage Tab'}</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]} numberOfLines={1}>
            {tab.icon ? `${tab.icon} ` : ''}{tab.title} · {template}
          </Text>
        </View>
      </View>

      {/* Manager body */}
      {template === 'bible' && (
        <BibleTabManager tab={tab} appId={appId} partnerId={partnerId} palette={palette} />
      )}
      {template === 'broadcast' && (
        <BroadcastTabManager tab={tab} appId={appId} partnerId={partnerId} palette={palette} />
      )}
      {template === 'dashboard' && (
        <DashboardWidgetManager tab={tab} appId={appId} partnerId={partnerId} palette={palette} />
      )}
      {(template === 'messaging' || template === 'workspace' || template === 'partner') && (
        <MessagingTabManager tab={tab} appId={appId} partnerId={partnerId} palette={palette} />
      )}
      {template === 'custom' && (
        <CustomTabInfo palette={palette} />
      )}
      {template === 'partner_geolocation_attendance' && (
        <AttendanceTabInfo palette={palette} />
      )}
      {template === 'profile' && (
        <ProfileTabInfo palette={palette} />
      )}
    </View>
  );
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

function SectionCard({ icon, title, description, palette, onPress }: {
  icon: string; title: string; description: string; palette: any; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { borderColor: palette.divider, backgroundColor: pressed ? palette.primary + '0D' : palette.surface }]}
    >
      <Text style={{ fontSize: 26, marginBottom: 6 }}>{icon}</Text>
      <Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.cardDesc, { color: palette.subtext }]}>{description}</Text>
    </Pressable>
  );
}

function FieldInput({ label, value, onChange, placeholder, multiline, palette, keyboardType }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; palette: any; keyboardType?: any;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={[styles.fieldLabel, { color: palette.subtext }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.subtext}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType}
        style={[
          styles.input,
          {
            color: palette.text,
            borderColor: palette.divider,
            backgroundColor: palette.surface,
            height: multiline ? 72 : 40,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
    </View>
  );
}

function Chips({ options, selected, onSelect, palette }: {
  options: { key: string; label: string }[]; selected: string; onSelect: (v: string) => void; palette: any;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
      {options.map(opt => (
        <Pressable
          key={opt.key}
          onPress={() => onSelect(opt.key)}
          style={[styles.chip, { backgroundColor: selected === opt.key ? palette.primary + '22' : 'transparent', borderColor: selected === opt.key ? palette.primary : palette.divider }]}
        >
          <Text style={{ color: selected === opt.key ? palette.primary : palette.subtext, fontSize: 11, fontWeight: '700' }}>{opt.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Bible Tab Manager ────────────────────────────────────────────────────────
// Two-pane manager for partner bible tabs:
//  • "Sections" — toggle which sections are visible + pin a featured scripture
//  • "Content" — full CRUD for devotionals, meditations, prayer days stored as
//                tab content blocks so members see partner-specific material

type BibleContentView = 'sections' | 'devotionals' | 'meditations' | 'prayer';

type BibleBlock = {
  id: string;
  block_type: string;
  title?: string;
  body?: string;
  payload?: Record<string, any>;
  created_at?: string;
};

function BibleTabManager({ tab, appId, partnerId, palette }: {
  tab: PartnerOrganizationAppTab; appId: string; partnerId: string; palette: any;
}) {
  const cfg = (tab.config ?? {}) as Record<string, any>;
  const [view, setView] = useState<BibleContentView>('sections');
  const [sections, setSections] = useState<string[]>(
    cfg.bible_sections ?? ['read', 'daily', 'meditations', 'prayer', 'plans', 'lessons'],
  );
  const [featuredRef, setFeaturedRef] = useState<string>(cfg.featured_reference ?? '');
  const [saving, setSaving] = useState(false);

  // Content blocks shared by all content sub-views
  const blocksUrl = ROUTES.partners.organizationAppTabBlocks(partnerId, appId, tab.id);
  const [blocks, setBlocks] = useState<BibleBlock[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);

  const loadBlocks = useCallback(async (type: string) => {
    setBlocksLoading(true);
    try {
      const res: any = await getRequest(blocksUrl);
      const all: BibleBlock[] = Array.isArray(res?.data) ? res.data : res?.data?.results ?? [];
      setBlocks(all.filter(b => b.block_type === type));
    } catch { /* silently ignored */ }
    finally { setBlocksLoading(false); }
  }, [blocksUrl]);

  useEffect(() => {
    if (view === 'devotionals') loadBlocks('devotional');
    else if (view === 'meditations') loadBlocks('meditation');
    else if (view === 'prayer') loadBlocks('prayer_day');
  }, [view, loadBlocks]);

  const BIBLE_SECTIONS = [
    { key: 'read', label: '📖 Scripture Reader' },
    { key: 'daily', label: '🌅 Daily Devotion' },
    { key: 'meditations', label: '🧘 Meditations' },
    { key: 'prayer', label: '🙏 Prayer Calendar' },
    { key: 'plans', label: '🗺 Reading Plans' },
    { key: 'discipleship', label: '🎓 Discipleship' },
    { key: 'books', label: '📚 Books Library' },
    { key: 'community', label: '💬 Prayer Requests' },
  ];

  const toggleSection = (key: string) => {
    setSections(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = ROUTES.partners.organizationAppTab(partnerId, appId, tab.id);
      await patchRequest(url, { config: { ...cfg, bible_sections: sections, featured_reference: featuredRef } });
      Alert.alert('Saved', 'Bible tab configuration updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const NAV_TABS: { key: BibleContentView; label: string }[] = [
    { key: 'sections', label: '⚙️ Sections' },
    { key: 'devotionals', label: '🌅 Devotionals' },
    { key: 'meditations', label: '🧘 Meditations' },
    { key: 'prayer', label: '🙏 Prayer Days' },
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-nav */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 14, paddingVertical: 8 }}
        style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.divider }}
      >
        {NAV_TABS.map(t => (
          <Pressable
            key={t.key}
            onPress={() => setView(t.key)}
            style={[styles.chip, {
              backgroundColor: view === t.key ? palette.primary + '22' : 'transparent',
              borderColor: view === t.key ? palette.primary : palette.divider,
            }]}
          >
            <Text style={{ color: view === t.key ? palette.primary : palette.subtext, fontSize: 11, fontWeight: '700' }}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Sections config */}
      {view === 'sections' && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 60 }}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Visible sections</Text>
          <Text style={[styles.small, { color: palette.subtext, marginBottom: 8 }]}>
            Toggle which sections appear in this Bible tab for your members.
          </Text>
          {BIBLE_SECTIONS.map(s => (
            <Pressable
              key={s.key}
              onPress={() => toggleSection(s.key)}
              style={[
                styles.toggleRow,
                {
                  borderColor: sections.includes(s.key) ? palette.primary + '66' : palette.divider,
                  backgroundColor: sections.includes(s.key) ? palette.primary + '0D' : palette.surface,
                },
              ]}
            >
              <Text style={[styles.cardTitle, { color: palette.text, flex: 1 }]}>{s.label}</Text>
              <View style={[styles.toggle, { backgroundColor: sections.includes(s.key) ? palette.primary : palette.divider }]}>
                <View style={[styles.toggleKnob, { right: sections.includes(s.key) ? 2 : undefined, left: sections.includes(s.key) ? undefined : 2 }]} />
              </View>
            </Pressable>
          ))}
          <Text style={[styles.sectionTitle, { color: palette.text, marginTop: 16 }]}>Featured scripture</Text>
          <FieldInput
            label="Pin a scripture reference (optional)"
            value={featuredRef}
            onChange={setFeaturedRef}
            placeholder="e.g. John 3:16 · shown at top of Bible tab"
            palette={palette}
          />
          <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: palette.primary }]}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Save configuration</Text>
            )}
          </Pressable>
        </ScrollView>
      )}

      {/* Devotionals */}
      {view === 'devotionals' && (
        <BibleContentEditor
          blockType="devotional"
          label="Devotional"
          icon="🌅"
          blocksUrl={blocksUrl}
          blocks={blocks}
          loading={blocksLoading}
          onReload={() => loadBlocks('devotional')}
          setBlocks={setBlocks}
          palette={palette}
          formFields={[
            { key: 'title', label: 'Title *', placeholder: 'e.g. Walking in Faith' },
            { key: 'body', label: 'Content *', placeholder: 'Write the devotional text...', multiline: true },
            { key: 'scripture', label: 'Scripture reference', placeholder: 'e.g. Romans 8:28', payloadKey: true },
            { key: 'date', label: 'Date (YYYY-MM-DD)', placeholder: 'e.g. 2025-06-15', payloadKey: true },
          ]}
        />
      )}

      {/* Meditations */}
      {view === 'meditations' && (
        <BibleContentEditor
          blockType="meditation"
          label="Meditation"
          icon="🧘"
          blocksUrl={blocksUrl}
          blocks={blocks}
          loading={blocksLoading}
          onReload={() => loadBlocks('meditation')}
          setBlocks={setBlocks}
          palette={palette}
          formFields={[
            { key: 'title', label: 'Title *', placeholder: 'e.g. Resting in His Presence' },
            { key: 'body', label: 'Reflection text *', placeholder: 'Write the meditation...', multiline: true },
            { key: 'theme', label: 'Theme / topic', placeholder: 'e.g. Peace, Surrender', payloadKey: true },
            { key: 'audio_url', label: 'Audio URL (optional)', placeholder: 'https://...', payloadKey: true },
          ]}
        />
      )}

      {/* Prayer days */}
      {view === 'prayer' && (
        <BibleContentEditor
          blockType="prayer_day"
          label="Prayer Day"
          icon="🙏"
          blocksUrl={blocksUrl}
          blocks={blocks}
          loading={blocksLoading}
          onReload={() => loadBlocks('prayer_day')}
          setBlocks={setBlocks}
          palette={palette}
          formFields={[
            { key: 'title', label: 'Focus / Title *', placeholder: 'e.g. Day 3 — Healing' },
            { key: 'body', label: 'Prayer text *', placeholder: 'Write the prayer or instructions...', multiline: true },
            { key: 'date', label: 'Date (YYYY-MM-DD)', placeholder: 'e.g. 2025-06-01', payloadKey: true },
            { key: 'scripture', label: 'Scripture', placeholder: 'e.g. James 5:16', payloadKey: true },
          ]}
        />
      )}
    </View>
  );
}

// ─── Generic bible content editor ─────────────────────────────────────────────
// Reusable CRUD panel used by devotionals, meditations, and prayer days.

type ContentFormField = {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  payloadKey?: boolean; // if true, stored in block.payload instead of root
};

function BibleContentEditor({
  blockType, label, icon, blocksUrl, blocks, loading, onReload, setBlocks, palette, formFields,
}: {
  blockType: string; label: string; icon: string; blocksUrl: string;
  blocks: BibleBlock[]; loading: boolean; onReload: () => void;
  setBlocks: React.Dispatch<React.SetStateAction<BibleBlock[]>>;
  palette: any; formFields: ContentFormField[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const setField = (key: string, value: string) =>
    setFormValues(prev => ({ ...prev, [key]: value }));

  const handleAdd = async () => {
    const titleField = formFields.find(f => f.key === 'title');
    const bodyField = formFields.find(f => f.key === 'body');
    if (titleField && !formValues.title?.trim()) { Alert.alert('Title required'); return; }
    if (bodyField && !formValues.body?.trim()) { Alert.alert('Content required'); return; }

    setSaving(true);
    try {
      const rootFields: Record<string, string> = {};
      const payloadFields: Record<string, string> = {};
      formFields.forEach(f => {
        const val = formValues[f.key]?.trim();
        if (!val) return;
        if (f.payloadKey) payloadFields[f.key] = val;
        else rootFields[f.key] = val;
      });

      const res: any = await postRequest(blocksUrl, {
        block_type: blockType,
        title: rootFields.title,
        body: rootFields.body,
        payload: payloadFields,
      });
      if (res?.id || res?.data?.id) {
        setBlocks(prev => [res?.data ?? res, ...prev]);
        setFormValues({});
        setShowForm(false);
      } else {
        Alert.alert('Error', res?.message || 'Could not save.');
      }
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = (block: BibleBlock) => {
    Alert.alert(`Delete ${label}`, 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteRequest(`${blocksUrl}${block.id}/`);
            setBlocks(prev => prev.filter(b => b.id !== block.id));
          } catch (e: any) { Alert.alert('Error', e?.message || 'Failed.'); }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60, gap: 10 }}>
      <Pressable onPress={() => setShowForm(s => !s)} style={[styles.addBtn, { borderColor: palette.primary }]}>
        <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 13 }}>
          {showForm ? '↑ Cancel' : `+ Add ${label}`}
        </Text>
      </Pressable>

      {showForm && (
        <View style={[styles.form, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
          <Text style={[styles.formTitle, { color: palette.text }]}>{icon} New {label}</Text>
          {formFields.map(f => (
            <FieldInput
              key={f.key}
              label={f.label}
              value={formValues[f.key] ?? ''}
              onChange={v => setField(f.key, v)}
              placeholder={f.placeholder}
              multiline={f.multiline}
              palette={palette}
            />
          ))}
          <Pressable onPress={handleAdd} disabled={saving} style={[styles.saveBtn, { backgroundColor: palette.primary }]}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Save {label}</Text>
            )}
          </Pressable>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={palette.primary} style={{ marginTop: 24 }} />
      ) : blocks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 36 }}>{icon}</Text>
          <Text style={[styles.small, { color: palette.subtext, textAlign: 'center', marginTop: 8 }]}>
            No {label.toLowerCase()}s yet. Add one above.
          </Text>
        </View>
      ) : (
        blocks.map(block => (
          <View key={block.id} style={[styles.listRow, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            <View style={{ flex: 1 }}>
              {block.title ? (
                <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>{block.title}</Text>
              ) : null}
              {block.body ? (
                <Text style={[styles.small, { color: palette.subtext }]} numberOfLines={2}>{block.body}</Text>
              ) : null}
              {block.payload && Object.keys(block.payload).length > 0 ? (
                <Text style={[styles.tiny, { color: palette.subtext, marginTop: 2 }]}>
                  {Object.entries(block.payload).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => handleDelete(block)} style={{ padding: 6 }}>
              <Text style={{ color: palette.danger ?? '#d9534f', fontSize: 16, fontWeight: '800' }}>×</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ─── Broadcast Tab Manager ────────────────────────────────────────────────────
// Compose and schedule posts/announcements for this app's broadcast/feed tab.

type BroadcastPost = {
  id: number;
  title?: string;
  body: string;
  status: string;
  created_at: string;
  scheduled_at?: string;
  image_url?: string;
};

function BroadcastTabManager({ tab, appId, partnerId, palette }: {
  tab: PartnerOrganizationAppTab; appId: string; partnerId: string; palette: any;
}) {
  const [posts, setPosts] = useState<BroadcastPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [body, setBody] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [postType, setPostType] = useState('announcement');

  const baseUrl = ROUTES.partners.organizationAppTabBlocks(partnerId, appId, tab.id);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await getRequest(baseUrl);
      const d = res?.data ?? res;
      setPosts(Array.isArray(d) ? d : d?.results ?? []);
    } catch { /* silently ignored */ }
    finally { setLoading(false); }
  }, [baseUrl]);

  useEffect(() => { load(); }, [load]);

  const handlePublish = async () => {
    if (!body.trim()) { Alert.alert('Content required'); return; }
    setSaving(true);
    try {
      const payload: any = {
        block_type: 'rich_text',
        title: postTitle.trim() || undefined,
        body: body.trim(),
        status: scheduleAt ? 'scheduled' : 'published',
        payload: {
          post_type: postType,
          image_url: imageUrl.trim() || undefined,
          scheduled_at: scheduleAt.trim() || undefined,
        },
      };
      const res: any = await postRequest(baseUrl, payload);
      if (res?.id || res?.data?.id) {
        setPosts(prev => [res?.data ?? res, ...prev]);
        setBody(''); setPostTitle(''); setImageUrl(''); setScheduleAt('');
        setShowForm(false);
      } else {
        Alert.alert('Error', res?.message || 'Could not post.');
      }
    } catch (e: any) { Alert.alert('Error', e?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = (post: BroadcastPost) => {
    Alert.alert('Delete post', 'Remove this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteRequest(`${baseUrl}${post.id}/`);
            setPosts(prev => prev.filter(p => p.id !== post.id));
          } catch (e: any) { Alert.alert('Error', e?.message || 'Failed.'); }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60, gap: 10 }}>
      <Pressable onPress={() => setShowForm(s => !s)} style={[styles.addBtn, { borderColor: palette.primary }]}>
        <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 13 }}>{showForm ? '↑ Cancel' : '+ Compose post / announcement'}</Text>
      </Pressable>

      {showForm && (
        <View style={[styles.form, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
          <Text style={[styles.formTitle, { color: palette.text }]}>New Post</Text>
          <Text style={[styles.fieldLabel, { color: palette.subtext }]}>Post type</Text>
          <Chips
            options={[
              { key: 'announcement', label: '📣 Announcement' },
              { key: 'update', label: '📝 Update' },
              { key: 'event', label: '📅 Event' },
              { key: 'devotional', label: '✝️ Devotional' },
            ]}
            selected={postType}
            onSelect={setPostType}
            palette={palette}
          />
          <FieldInput label="Title (optional)" value={postTitle} onChange={setPostTitle} placeholder="Post headline" palette={palette} />
          <FieldInput label="Content *" value={body} onChange={setBody} placeholder="Write your post..." multiline palette={palette} />
          <FieldInput label="Image URL (optional)" value={imageUrl} onChange={setImageUrl} placeholder="https://example.com/image.jpg" palette={palette} />
          <FieldInput label="Schedule (YYYY-MM-DD HH:MM) — blank to publish now" value={scheduleAt} onChange={setScheduleAt} placeholder="2025-06-15 09:00" palette={palette} />
          <Pressable onPress={handlePublish} disabled={saving} style={[styles.saveBtn, { backgroundColor: palette.primary }]}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{scheduleAt ? 'Schedule post' : 'Publish now'}</Text>
            )}
          </Pressable>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={palette.primary} style={{ marginTop: 24 }} />
      ) : posts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 36 }}>📡</Text>
          <Text style={[styles.small, { color: palette.subtext, textAlign: 'center', marginTop: 8 }]}>
            No posts yet. Compose your first announcement above.
          </Text>
        </View>
      ) : (
        posts.map(post => (
          <View key={post.id} style={[styles.listRow, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            <View style={{ flex: 1 }}>
              {post.title ? (
                <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>{post.title}</Text>
              ) : null}
              <Text style={[styles.small, { color: palette.subtext }]} numberOfLines={2}>{post.body}</Text>
              <Text style={[styles.tiny, { color: palette.subtext, marginTop: 2 }]}>
                {post.status} · {new Date(post.created_at).toLocaleDateString()}
              </Text>
            </View>
            <Pressable onPress={() => handleDelete(post)} style={{ padding: 6 }}>
              <Text style={{ color: palette.danger ?? '#d9534f', fontSize: 16, fontWeight: '800' }}>×</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ─── Dashboard Widget Manager ─────────────────────────────────────────────────
// Configure KPI widgets and data sources for a dashboard tab.

const WIDGET_TYPES = [
  { key: 'stat_card', label: '🔢 Stat Card', desc: 'Shows a single metric (members, posts, etc.)' },
  { key: 'chart_line', label: '📈 Line Chart', desc: 'Trends over time' },
  { key: 'chart_bar', label: '📊 Bar Chart', desc: 'Comparisons across categories' },
  { key: 'activity_feed', label: '🔔 Activity Feed', desc: 'Live activity stream' },
  { key: 'member_list', label: '👥 Member List', desc: 'Recent or active members' },
  { key: 'quick_links', label: '🔗 Quick Links', desc: 'Pinned navigation shortcuts' },
  { key: 'announcement', label: '📣 Pinned Announcement', desc: 'Always-visible banner' },
  { key: 'embed', label: '🖼 Embed', desc: 'Iframe or custom embed widget' },
];

type Widget = {
  id: string;
  type: string;
  title: string;
  data_source?: string;
  order: number;
};

function DashboardWidgetManager({ tab, appId, partnerId, palette }: {
  tab: PartnerOrganizationAppTab; appId: string; partnerId: string; palette: any;
}) {
  const cfg = (tab.config ?? {}) as Record<string, any>;
  const [widgets, setWidgets] = useState<Widget[]>(cfg.widgets ?? []);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [widgetType, setWidgetType] = useState('stat_card');
  const [widgetTitle, setWidgetTitle] = useState('');
  const [dataSource, setDataSource] = useState('');

  const handleAddWidget = () => {
    if (!widgetTitle.trim()) { Alert.alert('Widget title required.'); return; }
    const newWidget: Widget = {
      id: String(Date.now()),
      type: widgetType,
      title: widgetTitle.trim(),
      data_source: dataSource.trim() || undefined,
      order: widgets.length,
    };
    setWidgets(prev => [...prev, newWidget]);
    setWidgetTitle(''); setDataSource('');
    setShowAdd(false);
  };

  const handleRemove = (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = ROUTES.partners.organizationAppTab(partnerId, appId, tab.id);
      await patchRequest(url, { config: { ...cfg, widgets } });
      Alert.alert('Saved', 'Dashboard layout updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60, gap: 8 }}>
      <Text style={[styles.small, { color: palette.subtext, marginBottom: 4 }]}>
        Configure the widgets that appear on this dashboard tab. Drag to reorder — tap × to remove.
      </Text>

      {widgets.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 36 }}>📊</Text>
          <Text style={[styles.small, { color: palette.subtext, textAlign: 'center', marginTop: 8 }]}>No widgets yet.</Text>
        </View>
      ) : (
        widgets.map((w, idx) => (
          <View key={w.id} style={[styles.listRow, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
            <Text style={{ color: palette.subtext, fontWeight: '800', fontSize: 13, width: 24 }}>{idx + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{w.title}</Text>
              <Text style={[styles.tiny, { color: palette.subtext }]}>{w.type.replace(/_/g, ' ')}{w.data_source ? ` · ${w.data_source}` : ''}</Text>
            </View>
            <Pressable onPress={() => handleRemove(w.id)} style={{ padding: 6 }}>
              <Text style={{ color: palette.danger ?? '#d9534f', fontSize: 16, fontWeight: '800' }}>×</Text>
            </Pressable>
          </View>
        ))
      )}

      <Pressable onPress={() => setShowAdd(s => !s)} style={[styles.addBtn, { borderColor: palette.primary }]}>
        <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 13 }}>{showAdd ? '↑ Cancel' : '+ Add widget'}</Text>
      </Pressable>

      {showAdd && (
        <View style={[styles.form, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
          <Text style={[styles.formTitle, { color: palette.text }]}>Add Widget</Text>
          <Text style={[styles.fieldLabel, { color: palette.subtext }]}>Widget type</Text>
          <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
            {WIDGET_TYPES.map(wt => (
              <Pressable
                key={wt.key}
                onPress={() => setWidgetType(wt.key)}
                style={[
                  styles.widgetTypeRow,
                  {
                    borderColor: widgetType === wt.key ? palette.primary : palette.divider,
                    backgroundColor: widgetType === wt.key ? palette.primary + '0D' : 'transparent',
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>{wt.label}</Text>
                  <Text style={[styles.tiny, { color: palette.subtext }]}>{wt.desc}</Text>
                </View>
                {widgetType === wt.key ? (
                  <Text style={{ color: palette.primary, fontWeight: '900' }}>✓</Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
          <FieldInput label="Widget title *" value={widgetTitle} onChange={setWidgetTitle} placeholder="e.g. Total Members" palette={palette} />
          <FieldInput label="Data source (optional)" value={dataSource} onChange={setDataSource} placeholder="e.g. /api/v1/partners/stats/" palette={palette} />
          <Pressable onPress={handleAddWidget} style={[styles.saveBtn, { backgroundColor: palette.primary }]}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Add widget</Text>
          </Pressable>
        </View>
      )}

      {widgets.length > 0 && (
        <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: palette.primary, marginTop: 8 }]}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : (
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Save layout</Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

// ─── Messaging Tab Manager ────────────────────────────────────────────────────
// Configure channels / topics for a messaging or workspace tab.

function MessagingTabManager({ tab, appId, partnerId, palette }: {
  tab: PartnerOrganizationAppTab; appId: string; partnerId: string; palette: any;
}) {
  const cfg = (tab.config ?? {}) as Record<string, any>;
  const [channels, setChannels] = useState<any[]>(cfg.pinned_channels ?? []);
  const [topics, setTopics] = useState<string[]>(cfg.featured_topics ?? []);
  const [layout, setLayout] = useState<string>(cfg.messaging_layout ?? 'list');
  const [newChannel, setNewChannel] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = ROUTES.partners.organizationAppTab(partnerId, appId, tab.id);
      await patchRequest(url, { config: { ...cfg, pinned_channels: channels, featured_topics: topics, messaging_layout: layout } });
      Alert.alert('Saved', 'Messaging tab configuration updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60, gap: 10 }}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>Layout</Text>
      <Chips
        options={[
          { key: 'list', label: '📋 List view' },
          { key: 'compact', label: '⚡ Compact' },
          { key: 'community', label: '🏘 Community' },
        ]}
        selected={layout}
        onSelect={setLayout}
        palette={palette}
      />

      <Text style={[styles.sectionTitle, { color: palette.text, marginTop: 12 }]}>Pinned channels</Text>
      <Text style={[styles.small, { color: palette.subtext }]}>
        These channels appear at the top of this messaging tab.
      </Text>
      {channels.map((ch: any, i: number) => (
        <View key={i} style={[styles.listRow, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
          <Text style={[styles.cardTitle, { color: palette.text, flex: 1 }]}>#{ch.name ?? ch}</Text>
          <Pressable onPress={() => setChannels(prev => prev.filter((_, idx) => idx !== i))} style={{ padding: 6 }}>
            <Text style={{ color: palette.danger ?? '#d9534f', fontWeight: '800' }}>×</Text>
          </Pressable>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={newChannel}
          onChangeText={setNewChannel}
          placeholder="Channel name (e.g. general)"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { flex: 1, color: palette.text, borderColor: palette.divider, backgroundColor: palette.surface, height: 40 }]}
        />
        <Pressable
          onPress={() => { if (newChannel.trim()) { setChannels(prev => [...prev, { name: newChannel.trim() }]); setNewChannel(''); } }}
          style={[styles.addInlineBtn, { backgroundColor: palette.primary }]}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Add</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: palette.text, marginTop: 12 }]}>Featured topics</Text>
      {topics.map((t: string, i: number) => (
        <View key={i} style={[styles.listRow, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
          <Text style={[styles.cardTitle, { color: palette.text, flex: 1 }]}>{t}</Text>
          <Pressable onPress={() => setTopics(prev => prev.filter((_, idx) => idx !== i))} style={{ padding: 6 }}>
            <Text style={{ color: palette.danger ?? '#d9534f', fontWeight: '800' }}>×</Text>
          </Pressable>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={newTopic}
          onChangeText={setNewTopic}
          placeholder="Topic (e.g. Prayer & Worship)"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { flex: 1, color: palette.text, borderColor: palette.divider, backgroundColor: palette.surface, height: 40 }]}
        />
        <Pressable
          onPress={() => { if (newTopic.trim()) { setTopics(prev => [...prev, newTopic.trim()]); setNewTopic(''); } }}
          style={[styles.addInlineBtn, { backgroundColor: palette.primary }]}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Add</Text>
        </Pressable>
      </View>

      <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: palette.primary, marginTop: 8 }]}>
        {saving ? <ActivityIndicator size="small" color="#fff" /> : (
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Save configuration</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

// ─── Info screens for tabs that self-manage ───────────────────────────────────

function CustomTabInfo({ palette }: { palette: any }) {
  return (
    <View style={[styles.infoScreen, { backgroundColor: palette.surface }]}>
      <Text style={{ fontSize: 48 }}>✏️</Text>
      <Text style={[styles.infoTitle, { color: palette.text }]}>Custom Content Blocks</Text>
      <Text style={[styles.small, { color: palette.subtext, textAlign: 'center', lineHeight: 20 }]}>
        This tab uses the content block editor.{'\n\n'}
        Go back and use "Manage content" to add text, images, videos, files, links, and rich-text blocks.
      </Text>
    </View>
  );
}

function AttendanceTabInfo({ palette }: { palette: any }) {
  return (
    <View style={[styles.infoScreen, { backgroundColor: palette.surface }]}>
      <Text style={{ fontSize: 48 }}>📍</Text>
      <Text style={[styles.infoTitle, { color: palette.text }]}>Geolocation Attendance</Text>
      <Text style={[styles.small, { color: palette.subtext, textAlign: 'center', lineHeight: 20 }]}>
        Open this tab inside the live app to manage events, set geofences, and track check-ins.{'\n\n'}
        The attendance dashboard is built into the tab itself.
      </Text>
    </View>
  );
}

function ProfileTabInfo({ palette }: { palette: any }) {
  return (
    <View style={[styles.infoScreen, { backgroundColor: palette.surface }]}>
      <Text style={{ fontSize: 48 }}>👤</Text>
      <Text style={[styles.infoTitle, { color: palette.text }]}>Profile Tab</Text>
      <Text style={[styles.small, { color: palette.subtext, textAlign: 'center', lineHeight: 20 }]}>
        This tab renders the KIS user profile. No additional configuration is needed.{'\n\n'}
        Brand colors and theme are inherited from the app settings.
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 4,
  },
  backBtn: { paddingVertical: 8, paddingRight: 10, minWidth: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 11, marginTop: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 6 },
  card: { padding: 14, borderRadius: 12, borderWidth: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardDesc: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  listRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  small: { fontSize: 12, lineHeight: 17 },
  tiny: { fontSize: 10, lineHeight: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  addBtn: { borderWidth: 1.5, borderRadius: 10, borderStyle: 'dashed', paddingVertical: 10, alignItems: 'center', marginVertical: 4 },
  addInlineBtn: { borderRadius: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', height: 40 },
  form: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8 },
  formTitle: { fontSize: 13, fontWeight: '800', marginBottom: 12 },
  saveBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 6,
  },
  toggle: { width: 40, height: 22, borderRadius: 11, justifyContent: 'center' },
  toggleKnob: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  widgetTypeRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, borderRadius: 8, marginBottom: 4, gap: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  infoScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  infoTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
});
