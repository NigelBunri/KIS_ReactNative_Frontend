// src/screens/bots/BotKnowledgeScreen.tsx
// Bot Platform Phase 4 — a bot's own knowledge sources. Upload a file
// (PDF/DOCX/TXT/CSV), add a web page, or paste text; inspect each
// source's processing status and any error, deactivate/reactivate
// without deleting, delete outright, and test what an AI decision
// would actually retrieve for a sample question - all scoped to this
// one bot only, never shared with any other bot.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import DocumentPicker from 'react-native-document-picker';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';

type Source = {
  id: string;
  source_type: 'file' | 'url' | 'text';
  title: string;
  status: 'pending' | 'processing' | 'ready' | 'error' | 'deactivated';
  error_message: string;
  file_size_bytes: number | null;
  content_type: string;
  source_url: string;
  chunk_count: number;
  created_at: string;
};

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md', 'csv'];

function SectionCard({ title, children, palette }: { title: string; children: React.ReactNode; palette: any }) {
  return (
    <View style={{ borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.card, borderRadius: 18, padding: 14, gap: 10 }}>
      <Text style={{ fontSize: 14, fontWeight: '900', color: palette.text }}>{title}</Text>
      {children}
    </View>
  );
}

function statusColor(status: Source['status'], palette: any): string {
  if (status === 'ready') return palette.success ?? '#2E7D32';
  if (status === 'error') return palette.danger ?? '#C62828';
  if (status === 'deactivated') return palette.subtext;
  return palette.primaryStrong;
}

export default function BotKnowledgeScreen() {
  const { palette } = useKISTheme();
  const route = useRoute<any>();
  const botId: string = route.params?.botId;
  const botName: string = route.params?.botName ?? 'Bot';

  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [addMode, setAddMode] = useState<'file' | 'url' | 'text' | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');

  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<any[] | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const res = await getRequest(ROUTES.bots.knowledgeSources(botId), { forceNetwork: isRefresh });
    if (res?.success) setSources(Array.isArray(res.data) ? res.data : []);
    setLoading(false);
    setRefreshing(false);
  }, [botId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const resetAddForm = () => { setAddMode(null); setTitle(''); setUrl(''); setText(''); };

  const handlePickFile = async () => {
    try {
      const results = await DocumentPicker.pick({ type: [DocumentPicker.types.allFiles] });
      const file = results[0];
      const ext = (file.name || '').split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext || '')) {
        Alert.alert('Unsupported file', `Only ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()} files are accepted as knowledge sources.`);
        return;
      }
      setBusy(true);
      const form = new FormData();
      form.append('source_type', 'file');
      form.append('title', title.trim() || file.name || 'Untitled');
      form.append('file', { uri: file.uri, name: file.name || 'upload', type: file.type || 'application/octet-stream' } as any);
      const res: any = await postRequest(ROUTES.bots.knowledgeSources(botId), form);
      setBusy(false);
      if (res?.success) {
        resetAddForm();
        void load(true);
      } else {
        Alert.alert('Upload failed', res?.message || 'Could not add this file as a knowledge source.');
      }
    } catch (error: any) {
      setBusy(false);
      if (DocumentPicker.isCancel?.(error)) return;
      Alert.alert('Upload failed', error?.message ?? 'Could not select file.');
    }
  };

  const handleAddUrl = async () => {
    if (!url.trim()) { Alert.alert('URL required', 'Enter a web page address.'); return; }
    setBusy(true);
    const res: any = await postRequest(ROUTES.bots.knowledgeSources(botId), {
      source_type: 'url', title: title.trim() || url.trim(), url: url.trim(),
    });
    setBusy(false);
    if (res?.success) { resetAddForm(); void load(true); }
    else Alert.alert('Could not add URL', res?.message || 'This web page could not be added.');
  };

  const handleAddText = async () => {
    if (!text.trim()) { Alert.alert('Text required', 'Paste some text to save as knowledge.'); return; }
    setBusy(true);
    const res: any = await postRequest(ROUTES.bots.knowledgeSources(botId), {
      source_type: 'text', title: title.trim() || text.trim().slice(0, 60), text: text.trim(),
    });
    setBusy(false);
    if (res?.success) { resetAddForm(); void load(true); }
    else Alert.alert('Could not save text', res?.message || 'This text could not be saved.');
  };

  const handleToggleActive = async (source: Source) => {
    const url2 = source.status === 'deactivated'
      ? ROUTES.bots.knowledgeSourceReactivate(botId, source.id)
      : ROUTES.bots.knowledgeSourceDeactivate(botId, source.id);
    const res: any = await postRequest(url2, {});
    if (res?.success) void load(true);
  };

  const handleDelete = (source: Source) => {
    Alert.alert('Delete this knowledge source?', 'This permanently removes it and everything indexed from it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteRequest(ROUTES.bots.knowledgeSourceDetail(botId, source.id));
          void load(true);
        },
      },
    ]);
  };

  const handleTestRetrieval = async () => {
    if (!testQuery.trim()) return;
    setTesting(true);
    const res: any = await postRequest(ROUTES.bots.knowledgeTestRetrieval(botId), { query: testQuery.trim() });
    setTesting(false);
    setTestResults(res?.success ? (res.data?.results ?? []) : []);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background }}>
        <ActivityIndicator color={palette.primaryStrong} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <Text style={{ fontSize: 20, fontWeight: '900', color: palette.text }}>{botName}'s knowledge</Text>
        <Text style={{ fontSize: 13, color: palette.subtext }}>
          Documents, web pages, or notes this bot can refer to when its AI decides how to respond. Nothing here is
          shared with any other bot. Knowledge works without connecting AI too - it just has no decision step to feed
          into until AI is enabled for a workflow.
        </Text>

        <SectionCard title="Add knowledge" palette={palette}>
          <KISTextInput placeholder="Title (optional)" value={title} onChangeText={setTitle} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <KISButton title="Upload a file" size="sm" variant={addMode === 'file' ? 'primary' : 'outline'} onPress={() => setAddMode('file')} />
            <KISButton title="Add a web page" size="sm" variant={addMode === 'url' ? 'primary' : 'outline'} onPress={() => setAddMode('url')} />
            <KISButton title="Paste text" size="sm" variant={addMode === 'text' ? 'primary' : 'outline'} onPress={() => setAddMode('text')} />
          </View>
          {addMode === 'file' ? (
            <KISButton title={busy ? 'Uploading…' : `Choose a ${ALLOWED_EXTENSIONS.join('/').toUpperCase()} file`} onPress={handlePickFile} disabled={busy} loading={busy} />
          ) : null}
          {addMode === 'url' ? (
            <>
              <KISTextInput placeholder="https://example.org/article" value={url} onChangeText={setUrl} autoCapitalize="none" />
              <KISButton title={busy ? 'Adding…' : 'Add web page'} onPress={handleAddUrl} disabled={busy} loading={busy} />
            </>
          ) : null}
          {addMode === 'text' ? (
            <>
              <KISTextInput placeholder="Paste the text you want this bot to know" value={text} onChangeText={setText} multiline />
              <KISButton title={busy ? 'Saving…' : 'Save text'} onPress={handleAddText} disabled={busy} loading={busy} />
            </>
          ) : null}
        </SectionCard>

        <SectionCard title={`Sources (${sources.length})`} palette={palette}>
          {sources.length === 0 ? (
            <Text style={{ fontSize: 13, color: palette.subtext }}>No knowledge sources yet.</Text>
          ) : (
            sources.map((s) => (
              <View key={s.id} style={{ gap: 4, paddingVertical: 8, borderTopWidth: 1, borderTopColor: palette.divider }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text, flex: 1 }}>{s.title}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: statusColor(s.status, palette) }}>{s.status}</Text>
                </View>
                <Text style={{ fontSize: 11, color: palette.subtext }}>
                  {s.source_type === 'file' ? `File · ${s.content_type || 'unknown type'}` : s.source_type === 'url' ? s.source_url : 'Pasted text'}
                  {s.status === 'ready' ? ` · ${s.chunk_count} indexed section${s.chunk_count === 1 ? '' : 's'}` : ''}
                </Text>
                {s.error_message ? <Text style={{ fontSize: 11, color: palette.danger ?? '#C62828' }}>{s.error_message}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <KISButton
                    title={s.status === 'deactivated' ? 'Reactivate' : 'Deactivate'}
                    size="sm" variant="outline" onPress={() => handleToggleActive(s)}
                  />
                  <KISButton title="Delete" size="sm" variant="danger" onPress={() => handleDelete(s)} />
                </View>
              </View>
            ))
          )}
        </SectionCard>

        <SectionCard title="Test retrieval" palette={palette}>
          <Text style={{ fontSize: 12, color: palette.subtext }}>
            See exactly what an AI decision would pull from this bot's knowledge for a sample question - the same
            search used for real.
          </Text>
          <KISTextInput placeholder="Ask a sample question…" value={testQuery} onChangeText={setTestQuery} />
          <KISButton title={testing ? 'Searching…' : 'Test'} size="sm" onPress={handleTestRetrieval} disabled={testing} loading={testing} />
          {testResults !== null ? (
            testResults.length === 0 ? (
              <Text style={{ fontSize: 12, color: palette.subtext }}>No relevant knowledge found for this question.</Text>
            ) : (
              testResults.map((r, i) => (
                <View key={i} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: palette.divider, gap: 2 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: palette.text }}>From: {r.source_title}</Text>
                  <Text style={{ fontSize: 12, color: palette.subtext }}>{r.text}</Text>
                </View>
              ))
            )
          ) : null}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
