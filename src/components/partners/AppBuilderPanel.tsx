import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import useAppBuilder from '@/screens/tabs/partners/hooks/useAppBuilder';
import type { PartnerOrganizationApp, PartnerOrganizationAppTab, PartnerOrganizationAppContentBlock } from '@/screens/tabs/partners/hooks/usePartnerOrganizationApps';

import TabTemplateManager from '@/components/partners/TabTemplateManager';

// ─── Types ───────────────────────────────────────────────────────────────────

type BuilderView = 'apps' | 'app_detail' | 'tab_detail' | 'template_manage';

const LAYOUT_TYPES = ['bottom_tabs', 'top_tabs', 'side_tabs', 'single_page', 'scroll'] as const;
const TEMPLATES = ['custom', 'bible', 'messaging', 'workspace', 'broadcast', 'profile', 'dashboard', 'partner_geolocation_attendance'] as const;
const BLOCK_TYPES = ['text', 'rich_text', 'image', 'video', 'link', 'file', 'embed'] as const;
const STATUS_OPTIONS = ['draft', 'published', 'archived'] as const;

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId: string;
  onClose: () => void;
};

// ─── Panel ───────────────────────────────────────────────────────────────────

export default function AppBuilderPanel({ isOpen, panelWidth, panelTranslateX, partnerId, onClose }: Props) {
  const { palette } = useKISTheme();
  const builder = useAppBuilder(partnerId);

  const [view, setView] = useState<BuilderView>('apps');
  const [selectedApp, setSelectedApp] = useState<PartnerOrganizationApp | null>(null);
  const [selectedTab, setSelectedTab] = useState<PartnerOrganizationAppTab | null>(null);
  const [tabs, setTabs] = useState<PartnerOrganizationAppTab[]>([]);
  const [blocks, setBlocks] = useState<PartnerOrganizationAppContentBlock[]>([]);
  const [subLoading, setSubLoading] = useState(false);

  // App form
  const [appName, setAppName] = useState('');
  const [appDesc, setAppDesc] = useState('');
  const [appIcon, setAppIcon] = useState('');
  const [appLayout, setAppLayout] = useState<string>('bottom_tabs');
  const [appStatus, setAppStatus] = useState<string>('draft');
  const [showCreateApp, setShowCreateApp] = useState(false);

  // Tab form
  const [tabTitle, setTabTitle] = useState('');
  const [tabIcon, setTabIcon] = useState('');
  const [tabTemplate, setTabTemplate] = useState<string>('custom');
  const [showCreateTab, setShowCreateTab] = useState(false);

  // Block form
  const [blockType, setBlockType] = useState<string>('text');
  const [blockTitle, setBlockTitle] = useState('');
  const [blockBody, setBlockBody] = useState('');
  const [blockUrl, setBlockUrl] = useState('');
  const [showCreateBlock, setShowCreateBlock] = useState(false);

  useEffect(() => {
    if (isOpen) builder.loadApps();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const openApp = useCallback(async (app: PartnerOrganizationApp) => {
    setSelectedApp(app);
    setView('app_detail');
    setSubLoading(true);
    const loadedTabs = await builder.loadTabs(app.id);
    setTabs(loadedTabs);
    setSubLoading(false);
  }, [builder]);

  const openTab = useCallback(async (tab: PartnerOrganizationAppTab) => {
    if (!selectedApp) return;
    setSelectedTab(tab);
    setView('tab_detail');
    setSubLoading(true);
    const loadedBlocks = await builder.loadBlocks(selectedApp.id, tab.id);
    setBlocks(loadedBlocks);
    setSubLoading(false);
  }, [builder, selectedApp]);

  const handleCreateApp = useCallback(async () => {
    if (!appName.trim()) {
      Alert.alert('Name required', 'Please enter an app name.');
      return;
    }
    const app = await builder.createApp({
      name: appName.trim(),
      description: appDesc.trim() || undefined,
      icon: appIcon.trim() || undefined,
      status: appStatus as any,
      config: { layout_type: appLayout },
    });
    if (app) {
      setAppName(''); setAppDesc(''); setAppIcon(''); setAppLayout('bottom_tabs'); setAppStatus('draft');
      setShowCreateApp(false);
    }
  }, [appName, appDesc, appIcon, appLayout, appStatus, builder]);

  const handleDeleteApp = useCallback((app: PartnerOrganizationApp) => {
    Alert.alert('Delete app', `Delete "${app.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await builder.deleteApp(app.id);
          if (selectedApp?.id === app.id) {
            setSelectedApp(null);
            setView('apps');
          }
        },
      },
    ]);
  }, [builder, selectedApp]);

  const handleCreateTab = useCallback(async () => {
    if (!selectedApp || !tabTitle.trim()) {
      Alert.alert('Title required', 'Please enter a tab title.');
      return;
    }
    const tab = await builder.createTab(selectedApp.id, {
      title: tabTitle.trim(),
      icon: tabIcon.trim() || undefined,
      config: { template: tabTemplate },
    });
    if (tab) {
      setTabs((prev) => [...prev, tab]);
      setTabTitle(''); setTabIcon(''); setTabTemplate('custom');
      setShowCreateTab(false);
    }
  }, [builder, selectedApp, tabTitle, tabIcon, tabTemplate]);

  const handleDeleteTab = useCallback((tab: PartnerOrganizationAppTab) => {
    if (!selectedApp) return;
    Alert.alert('Delete tab', `Delete tab "${tab.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const ok = await builder.deleteTab(selectedApp.id, tab.id);
          if (ok) {
            setTabs((prev) => prev.filter((t) => t.id !== tab.id));
            if (selectedTab?.id === tab.id) {
              setSelectedTab(null);
              setView('app_detail');
            }
          }
        },
      },
    ]);
  }, [builder, selectedApp, selectedTab]);

  const handleCreateBlock = useCallback(async () => {
    if (!selectedApp || !selectedTab) return;
    if (blockType !== 'text' && blockType !== 'rich_text' && !blockBody.trim() && !blockUrl.trim()) {
      Alert.alert('Content required', 'Please enter body text or a URL.');
      return;
    }
    const block = await builder.createBlock(selectedApp.id, selectedTab.id, {
      block_type: blockType,
      title: blockTitle.trim() || undefined,
      body: blockBody.trim() || undefined,
      media_url: blockUrl.trim() || undefined,
      payload: blockUrl.trim() ? { url: blockUrl.trim() } : undefined,
      status: 'published',
    });
    if (block) {
      setBlocks((prev) => [...prev, block]);
      setBlockType('text'); setBlockTitle(''); setBlockBody(''); setBlockUrl('');
      setShowCreateBlock(false);
    }
  }, [builder, selectedApp, selectedTab, blockType, blockTitle, blockBody, blockUrl]);

  const handleDeleteBlock = useCallback((block: PartnerOrganizationAppContentBlock) => {
    if (!selectedApp || !selectedTab) return;
    Alert.alert('Delete block', 'Delete this content block?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const ok = await builder.deleteBlock(selectedApp.id, selectedTab.id, block.id);
          if (ok) setBlocks((prev) => prev.filter((b) => b.id !== block.id));
        },
      },
    ]);
  }, [builder, selectedApp, selectedTab]);

  if (!isOpen) return null;

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderChips = (options: readonly string[], selected: string, onSelect: (v: string) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          onPress={() => onSelect(opt)}
          style={[
            styles.chip,
            {
              backgroundColor: selected === opt ? palette.primary + '22' : 'transparent',
              borderColor: selected === opt ? palette.primary : palette.border,
            },
          ]}
        >
          <Text style={{ color: selected === opt ? palette.primary : palette.subtext, fontSize: 11, fontWeight: '700' }}>
            {opt.replace('_', ' ')}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderBlockPreview = (block: PartnerOrganizationAppContentBlock) => (
    <View key={block.id} style={[styles.blockRow, { borderColor: palette.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: palette.text }]}>
          [{block.block_type?.toUpperCase()}] {block.title || block.body?.slice(0, 40) || block.media_url?.slice(0, 40) || '(no content)'}
        </Text>
        <Text style={[styles.small, { color: palette.subtext }]}>{block.status ?? 'draft'} · active: {block.is_active ? 'yes' : 'no'}</Text>
      </View>
      <Pressable onPress={() => handleDeleteBlock(block)} style={styles.deleteBtn}>
        <Text style={{ color: palette.danger ?? '#d9534f', fontWeight: '700', fontSize: 12 }}>✕</Text>
      </Pressable>
    </View>
  );

  const renderTabRow = (tab: PartnerOrganizationAppTab) => {
    const blockCount = tab.content_blocks?.length ?? 0;
    const template = (tab.config as any)?.template ?? 'custom';
    const isRichTemplate = !['custom', 'profile'].includes(template);
    return (
      <View key={tab.id} style={[styles.tabRow, { borderColor: palette.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: palette.text }]}>
            {tab.icon ? `${tab.icon} ` : ''}{tab.title}
          </Text>
          <Text style={[styles.small, { color: palette.subtext }]}>
            {template} · {blockCount} {blockCount === 1 ? 'block' : 'blocks'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {isRichTemplate && (
            <Pressable
              onPress={() => {
                setSelectedTab(tab);
                setView('template_manage');
              }}
              style={[styles.manageTabBtn, { backgroundColor: palette.primary + '18', borderColor: palette.primary }]}
            >
              <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 11 }}>
                Configure
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => openTab(tab)}
            style={[styles.manageTabBtn, { backgroundColor: palette.primary + '18', borderColor: palette.primary + '44' }]}
          >
            <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 11 }}>
              {blockCount === 0 ? '+ Blocks' : 'Blocks'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleDeleteTab(tab)}
            style={{ padding: 6 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ color: palette.danger ?? '#d9534f', fontWeight: '700', fontSize: 13 }}>✕</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderAppRow = (app: PartnerOrganizationApp) => (
    <Pressable key={app.id} onPress={() => openApp(app)} style={[styles.appRow, { borderColor: palette.border }]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {app.icon ? <Text style={{ fontSize: 20 }}>{app.icon}</Text> : null}
          <Text style={[styles.appName, { color: palette.text }]} numberOfLines={1}>{app.name}</Text>
          <StatusPill status={app.status ?? 'draft'} palette={palette} />
        </View>
        <Text style={[styles.small, { color: palette.subtext, marginTop: 2 }]}>
          {(app.config as any)?.layout_type ?? 'bottom_tabs'} · {app.tabs?.length ?? 0} tabs
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 12 }}>Edit →</Text>
        <Pressable onPress={() => handleDeleteApp(app)}>
          <Text style={{ color: palette.danger ?? '#d9534f', fontWeight: '700', fontSize: 13 }}>✕</Text>
        </Pressable>
      </View>
    </Pressable>
  );

  // ── Views ─────────────────────────────────────────────────────────────────

  const renderAppsView = () => (
    <>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>App Builder</Text>
        <Pressable onPress={onClose}>
          <Text style={{ color: palette.subtext, fontSize: 20 }}>✕</Text>
        </Pressable>
      </View>

      {builder.loading ? (
        <View style={styles.centered}><ActivityIndicator color={palette.primary} /></View>
      ) : builder.error ? (
        <View style={styles.centered}>
          <Text style={{ color: palette.danger ?? '#d9534f' }}>{builder.error}</Text>
          <Pressable onPress={builder.loadApps} style={{ marginTop: 12 }}>
            <Text style={{ color: palette.primary, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60 }}>
          {/* App list */}
          {builder.apps.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 36 }}>🛠️</Text>
              <Text style={[styles.small, { color: palette.subtext, textAlign: 'center', marginTop: 8 }]}>
                No apps yet. Create your first organization app below.
              </Text>
            </View>
          ) : (
            builder.apps.map(renderAppRow)
          )}

          {/* Create app form */}
          <Pressable
            onPress={() => setShowCreateApp((s) => !s)}
            style={[styles.addBtn, { borderColor: palette.primary }]}
          >
            <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 13 }}>
              {showCreateApp ? '↑ Cancel' : '+ New app'}
            </Text>
          </Pressable>

          {showCreateApp && (
            <View style={[styles.form, { borderColor: palette.border, backgroundColor: palette.card ?? palette.surface }]}>
              <Text style={[styles.formTitle, { color: palette.text }]}>New app</Text>
              <FormField label="Name *" value={appName} onChange={setAppName} placeholder="e.g. KCAN Bible" palette={palette} />
              <FormField label="Description" value={appDesc} onChange={setAppDesc} placeholder="Short description" multiline palette={palette} />
              <FormField label="Icon (emoji)" value={appIcon} onChange={setAppIcon} placeholder="📖" palette={palette} />
              <Text style={[styles.fieldLabel, { color: palette.subtext }]}>Layout</Text>
              {renderChips(LAYOUT_TYPES, appLayout, setAppLayout)}
              <Text style={[styles.fieldLabel, { color: palette.subtext, marginTop: 8 }]}>Status</Text>
              {renderChips(STATUS_OPTIONS, appStatus, setAppStatus)}
              <Pressable
                onPress={handleCreateApp}
                disabled={builder.saving}
                style={[styles.saveBtn, { backgroundColor: palette.primary }]}
              >
                {builder.saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Create app</Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </>
  );

  const renderAppDetailView = () => {
    if (!selectedApp) return null;
    return (
      <>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Pressable onPress={() => { setView('apps'); setSelectedApp(null); setTabs([]); }}>
            <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 13 }}>← Apps</Text>
          </Pressable>
          <Text style={[styles.title, { color: palette.text, flex: 1, textAlign: 'center' }]} numberOfLines={1}>
            {selectedApp.icon ? `${selectedApp.icon} ` : ''}{selectedApp.name}
          </Text>
          <Pressable onPress={onClose}>
            <Text style={{ color: palette.subtext, fontSize: 20 }}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60 }}>
          {/* App summary */}
          <View style={[styles.infoCard, { borderColor: palette.border }]}>
            <Text style={[styles.small, { color: palette.subtext }]}>
              Layout: {(selectedApp.config as any)?.layout_type ?? 'bottom_tabs'} · Status: {selectedApp.status ?? 'draft'}
            </Text>
            {selectedApp.description ? (
              <Text style={[styles.small, { color: palette.subtext, marginTop: 4 }]}>{selectedApp.description}</Text>
            ) : null}
          </View>

          {/* Tabs */}
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Tabs</Text>
          {subLoading ? (
            <ActivityIndicator color={palette.primary} style={{ marginVertical: 20 }} />
          ) : tabs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.small, { color: palette.subtext, textAlign: 'center' }]}>No tabs. Add one below.</Text>
            </View>
          ) : (
            tabs.map(renderTabRow)
          )}

          <Pressable
            onPress={() => setShowCreateTab((s) => !s)}
            style={[styles.addBtn, { borderColor: palette.primary }]}
          >
            <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 13 }}>
              {showCreateTab ? '↑ Cancel' : '+ New tab'}
            </Text>
          </Pressable>

          {showCreateTab && (
            <View style={[styles.form, { borderColor: palette.border, backgroundColor: palette.card ?? palette.surface }]}>
              <Text style={[styles.formTitle, { color: palette.text }]}>New tab</Text>
              <FormField label="Title *" value={tabTitle} onChange={setTabTitle} placeholder="e.g. Home" palette={palette} />
              <FormField label="Icon (emoji)" value={tabIcon} onChange={setTabIcon} placeholder="🏠" palette={palette} />
              <Text style={[styles.fieldLabel, { color: palette.subtext, marginTop: 6 }]}>Page template</Text>
              {renderChips(TEMPLATES, tabTemplate, setTabTemplate)}
              <Pressable
                onPress={handleCreateTab}
                disabled={builder.saving}
                style={[styles.saveBtn, { backgroundColor: palette.primary }]}
              >
                {builder.saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Create tab</Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </>
    );
  };

  const renderTabDetailView = () => {
    if (!selectedApp || !selectedTab) return null;
    return (
      <>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Pressable onPress={() => { setView('app_detail'); setSelectedTab(null); setBlocks([]); }}>
            <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 13 }}>← Tabs</Text>
          </Pressable>
          <Text style={[styles.title, { color: palette.text, flex: 1, textAlign: 'center' }]} numberOfLines={1}>
            {selectedTab.icon ? `${selectedTab.icon} ` : ''}{selectedTab.title}
          </Text>
          <Pressable onPress={onClose}>
            <Text style={{ color: palette.subtext, fontSize: 20 }}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60 }}>
          {/* Tab info */}
          <View style={[styles.infoCard, { borderColor: palette.border }]}>
            <Text style={[styles.small, { color: palette.subtext }]}>
              Template: {((selectedTab.config as any)?.template) ?? 'custom'}
            </Text>
          </View>

          {/* Content blocks */}
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Content blocks</Text>
          {subLoading ? (
            <ActivityIndicator color={palette.primary} style={{ marginVertical: 20 }} />
          ) : blocks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.small, { color: palette.subtext, textAlign: 'center' }]}>No blocks yet. Add one below.</Text>
            </View>
          ) : (
            blocks.map(renderBlockPreview)
          )}

          <Pressable
            onPress={() => setShowCreateBlock((s) => !s)}
            style={[styles.addBtn, { borderColor: palette.primary }]}
          >
            <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 13 }}>
              {showCreateBlock ? '↑ Cancel' : '+ Add content block'}
            </Text>
          </Pressable>

          {showCreateBlock && (
            <View style={[styles.form, { borderColor: palette.border, backgroundColor: palette.card ?? palette.surface }]}>
              <Text style={[styles.formTitle, { color: palette.text }]}>New block</Text>
              <Text style={[styles.fieldLabel, { color: palette.subtext }]}>Type</Text>
              {renderChips(BLOCK_TYPES, blockType, setBlockType)}
              <FormField label="Title" value={blockTitle} onChange={setBlockTitle} placeholder="Optional heading" palette={palette} />
              <FormField label="Body text" value={blockBody} onChange={setBlockBody} placeholder="Your content..." multiline palette={palette} />
              {['image', 'video', 'file', 'link', 'embed'].includes(blockType) ? (
                <FormField label="URL / link" value={blockUrl} onChange={setBlockUrl} placeholder="https://…" palette={palette} />
              ) : null}
              <Pressable
                onPress={handleCreateBlock}
                disabled={builder.saving}
                style={[styles.saveBtn, { backgroundColor: palette.primary }]}
              >
                {builder.saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Add block</Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </>
    );
  };

  // ── Panel shell ───────────────────────────────────────────────────────────

  return (
    <Animated.View
      style={[
        styles.panel,
        {
          width: panelWidth,
          backgroundColor: palette.surface ?? palette.bg,
          borderLeftColor: palette.border,
          transform: [{ translateX: panelTranslateX }],
        },
      ]}
    >
      {view === 'apps' && renderAppsView()}
      {view === 'app_detail' && renderAppDetailView()}
      {view === 'tab_detail' && renderTabDetailView()}
      {view === 'template_manage' && selectedApp && selectedTab && (
        <TabTemplateManager
          tab={selectedTab}
          appId={selectedApp.id}
          partnerId={partnerId}
          onBack={() => { setView('app_detail'); }}
        />
      )}
    </Animated.View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormField({
  label, value, onChange, placeholder, multiline, palette,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  palette: any;
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
        style={[
          styles.input,
          {
            color: palette.text,
            borderColor: palette.border,
            backgroundColor: palette.bg ?? palette.chrome,
            height: multiline ? 72 : 40,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
    </View>
  );
}

function StatusPill({ status, palette }: { status: string; palette: any }) {
  const color = status === 'published' ? palette.success ?? '#27AE60'
    : status === 'archived' ? palette.subtext
    : palette.primary;
  return (
    <View style={[styles.pill, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={{ color, fontSize: 9, fontWeight: '800' }}>{status}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    borderLeftWidth: 1,
    zIndex: 130,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 15, fontWeight: '900' },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 8, marginTop: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  appName: { fontSize: 14, fontWeight: '700', flex: 1 },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    gap: 8,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    gap: 8,
  },
  addBtn: {
    borderWidth: 1.5,
    borderRadius: 10,
    borderStyle: 'dashed',
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  form: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  formTitle: { fontSize: 13, fontWeight: '800', marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  saveBtn: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  deleteBtn: {
    padding: 6,
  },
  manageTabBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  label: { fontSize: 13, fontWeight: '600' },
  small: { fontSize: 11, lineHeight: 16 },
  pill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
});
