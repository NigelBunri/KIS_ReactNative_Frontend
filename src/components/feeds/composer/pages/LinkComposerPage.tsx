// src/components/feeds/composer/pages/LinkComposerPage.tsx
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { launchImageLibrary } from 'react-native-image-picker';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import type { LinkSettings } from '../types';

const CAPTION_LIMIT = 500;

const extractMeta = (html: string, property: string): string | undefined => {
  const tags = html.match(/<meta[^>]+>/gi) || [];
  for (const tag of tags) {
    const isMatch =
      new RegExp(`property=["']${property}["']`, 'i').test(tag) ||
      new RegExp(`name=["']${property}["']`, 'i').test(tag);
    if (isMatch) {
      const content = tag.match(/content=["']([^"']*)["']/i);
      if (content?.[1]) return content[1];
    }
  }
  return undefined;
};

export function LinkComposerPage({
  link,
  setLink,
  caption,
  setCaption,
  linkSettings,
  setLinkSettings,
}: {
  link: string;
  setLink: (v: string) => void;
  caption: string;
  setCaption: (v: string) => void;
  linkSettings: LinkSettings;
  setLinkSettings: React.Dispatch<React.SetStateAction<LinkSettings>>;
}) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const updateSetting = useCallback(
    <K extends keyof LinkSettings>(key: K, value: LinkSettings[K]) => {
      setLinkSettings(prev => ({ ...prev, [key]: value }));
    },
    [setLinkSettings],
  );

  const isValidUrl = /^https?:\/\/.+/i.test(link.trim());

  const fetchPreview = useCallback(async () => {
    if (!isValidUrl) {
      setFetchError('Enter a valid http:// or https:// link first.');
      return;
    }
    setFetchError(null);
    setLoading(true);
    try {
      const res = await fetch(link.trim());
      const html = await res.text();
      const title = extractMeta(html, 'og:title') || html.match(/<title>([^<]+)<\/title>/i)?.[1];
      const description = extractMeta(html, 'og:description') || extractMeta(html, 'description');
      const image = extractMeta(html, 'og:image');
      setLinkSettings(prev => ({
        ...prev,
        previewTitle: title?.trim() || prev.previewTitle,
        previewDescription: description?.trim() || prev.previewDescription,
        previewImage: image || prev.previewImage,
      }));
    } catch {
      setFetchError("Couldn't load a preview for this link — you can still fill it in manually.");
    } finally {
      setLoading(false);
    }
  }, [isValidUrl, link, setLinkSettings]);

  const pasteFromClipboard = useCallback(async () => {
    const text = await Clipboard.getString();
    if (text) setLink(text.trim());
  }, [setLink]);

  const pickCustomImage = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
    if (result.didCancel || !result.assets?.length) return;
    const uri = result.assets[0]?.uri;
    if (uri) updateSetting('previewImage', uri);
  }, [updateSetting]);

  const resetPreview = useCallback(() => {
    setLinkSettings(prev => ({ ...prev, previewTitle: '', previewDescription: '', previewImage: null }));
  }, [setLinkSettings]);

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.urlRow}>
        <TextInput
          placeholder="Paste a link"
          placeholderTextColor={palette.subtext}
          value={link}
          onChangeText={v => {
            setLink(v);
            setFetchError(null);
          }}
          autoCapitalize="none"
          keyboardType="url"
          style={[
            styles.input,
            styles.urlInput,
            { color: palette.text, borderColor: link.trim() && !isValidUrl ? palette.danger : palette.divider },
          ]}
        />
        <Pressable onPress={pasteFromClipboard} accessibilityRole="button" accessibilityLabel="Paste from clipboard" style={{ padding: 8 }}>
          <KISIcon name="copy" size={18} color={palette.text} />
        </Pressable>
      </View>
      {link.trim() && !isValidUrl ? (
        <Text style={[styles.errorText, { color: palette.danger }]}>Link must start with http:// or https://</Text>
      ) : null}

      <Pressable
        onPress={fetchPreview}
        disabled={loading || !isValidUrl}
        style={[styles.secondaryButton, { borderColor: palette.divider, opacity: loading || !isValidUrl ? 0.5 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Fetch link preview"
      >
        {loading ? (
          <ActivityIndicator size="small" color={palette.primary} />
        ) : (
          <Text style={{ color: palette.text, fontWeight: '900' }}>Fetch preview</Text>
        )}
      </Pressable>
      {fetchError ? <Text style={[styles.errorText, { color: palette.danger }]}>{fetchError}</Text> : null}

      {(linkSettings.previewTitle || linkSettings.previewDescription || linkSettings.previewImage) ? (
        <View style={[styles.previewCard, { borderColor: palette.divider, backgroundColor: palette.card ?? '#FFFFFF' }]}>
          {linkSettings.previewImage ? (
            <Image source={{ uri: linkSettings.previewImage }} style={styles.previewImage} resizeMode="cover" />
          ) : null}
          <TextInput
            placeholder="Preview title"
            placeholderTextColor={palette.subtext}
            value={linkSettings.previewTitle}
            onChangeText={v => updateSetting('previewTitle', v)}
            style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
          />
          <TextInput
            placeholder="Preview description"
            placeholderTextColor={palette.subtext}
            value={linkSettings.previewDescription}
            onChangeText={v => updateSetting('previewDescription', v)}
            multiline
            style={[styles.input, styles.textarea, { color: palette.text, borderColor: palette.divider }]}
          />
          <View style={styles.previewActionsRow}>
            <Pressable onPress={pickCustomImage} accessibilityRole="button" accessibilityLabel="Choose custom preview image">
              <Text style={{ color: palette.primaryStrong, fontWeight: '800', fontSize: 12 }}>
                {linkSettings.previewImage ? 'Change image' : 'Add image'}
              </Text>
            </Pressable>
            <Pressable onPress={resetPreview} accessibilityRole="button" accessibilityLabel="Remove preview">
              <Text style={{ color: palette.danger, fontWeight: '800', fontSize: 12 }}>Remove preview</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.settingRow}>
        <Text style={{ color: palette.text, fontWeight: '800', fontSize: 12 }}>Open link in-app</Text>
        <Switch
          value={!linkSettings.openExternally}
          onValueChange={v => updateSetting('openExternally', !v)}
          trackColor={{ false: palette.divider, true: palette.primaryStrong }}
          thumbColor={palette.onPrimary}
        />
      </View>

      <View>
        <TextInput
          placeholder="Add a caption (optional)"
          placeholderTextColor={palette.subtext}
          value={caption}
          onChangeText={v => setCaption(v.slice(0, CAPTION_LIMIT))}
          multiline
          style={[styles.input, styles.textarea, { color: palette.text, borderColor: palette.divider, minHeight: 96 }]}
        />
        <Text style={[styles.counter, { color: palette.subtext }]}>{caption.length}/{CAPTION_LIMIT}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  textarea: { textAlignVertical: 'top' },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  urlInput: { flex: 1 },
  errorText: { fontSize: 12, fontWeight: '700' },
  secondaryButton: {
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  previewImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
  },
  previewActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    textAlign: 'right',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
});
