// src/components/composer/FeatureToolbar.tsx
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { FeatureAction, FeatureCategory, FeatureContext } from './types';

const CATS: { key: FeatureCategory | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'grid' },
  { key: 'inline', label: 'Inline', icon: 'text' },
  { key: 'block', label: 'Blocks', icon: 'list' },
  { key: 'style', label: 'Style', icon: 'palette' },
  { key: 'layout', label: 'Layout', icon: 'align-left' },
  { key: 'insert', label: 'Insert', icon: 'plus' },
  { key: 'review', label: 'Review', icon: 'history' },
  { key: 'tools', label: 'Tools', icon: 'settings' },
  { key: 'media', label: 'Media', icon: 'image' },
  { key: 'accessibility', label: 'A11y', icon: 'eye' },
  { key: 'automation', label: 'Auto', icon: 'calendar' },
];

export default function FeatureToolbar({
  ctx,
  actions,
}: {
  ctx: FeatureContext;
  actions: FeatureAction[];
}) {
  const { palette } = useKISTheme();
  const [cat, setCat] = useState<(typeof CATS)[number]['key']>('all');
  const [q, setQ] = useState('');
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [recents, setRecents] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return actions.filter((a) => {
      if (cat !== 'all' && a.category !== cat) return false;
      if (!needle) return true;
      return (
        a.label.toLowerCase().includes(needle) ||
        a.id.toLowerCase().includes(needle) ||
        (a.badge ?? '').toLowerCase().includes(needle)
      );
    });
  }, [actions, cat, q]);

  const topRow = useMemo(() => {
    const fav = actions.filter((a) => favorites[a.id]);
    const rest = actions.filter((a) => !favorites[a.id]);
    return [...fav, ...rest].slice(0, 12);
  }, [actions, favorites]);

  const run = (a: FeatureAction) => {
    const isEnabled = a.enabled ? a.enabled(ctx) : true;
    if (!isEnabled) return ctx.toast('Select text or try another context.');

    a.run(ctx);
    setRecents((prev) => {
      const next = [a.id, ...prev.filter((x) => x !== a.id)];
      return next.slice(0, 10);
    });
  };

  const toggleFavorite = (id: string) => {
    setFavorites((p) => ({ ...p, [id]: !p[id] }));
  };

  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: palette.divider,
        backgroundColor: palette.card,
        borderRadius: 18,
        padding: 12,
        gap: 10,
      }}
    >
      {/* Search */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 14,
          paddingHorizontal: 10,
          paddingVertical: 8,
          backgroundColor: palette.surface,
          gap: 8,
        }}
      >
        <KISIcon name="search" size={18} color={palette.subtext} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search tools…"
          placeholderTextColor={palette.subtext}
          style={{ color: palette.text, flex: 1, padding: 0 }}
        />
        {!!q && (
          <Pressable onPress={() => setQ('')} style={{ padding: 4 }}>
            <KISIcon name="close" size={16} color={palette.subtext} />
          </Pressable>
        )}
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {CATS.map((c) => {
          const active = c.key === cat;
          return (
            <Pressable
              key={c.key}
              onPress={() => setCat(c.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: active ? palette.primary : palette.divider,
                backgroundColor: active ? 'rgba(0,0,0,0.05)' : palette.card,
              }}
            >
              <KISIcon name={c.icon as any} size={16} color={active ? palette.primary : palette.subtext} />
              <Text style={{ color: palette.text, fontWeight: active ? '800' : '600', fontSize: 12 }}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Quick row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {topRow.map((a) => {
          const isEnabled = a.enabled ? a.enabled(ctx) : true;
          return (
            <Pressable
              key={a.id}
              onPress={() => run(a)}
              onLongPress={() => toggleFavorite(a.id)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: isEnabled ? palette.divider : 'transparent',
                backgroundColor: isEnabled ? palette.surface : 'rgba(0,0,0,0.04)',
                opacity: isEnabled ? 1 : 0.6,
              }}
            >
              <Text style={{ color: palette.text, fontWeight: '800', fontSize: 12 }}>
                {favorites[a.id] ? '★ ' : ''}
                {a.label}
                {a.badge ? ` · ${a.badge}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* FULL GRID with vertical scrolling (no slicing) */}
      <View style={{ maxHeight: 320 }}>
        <ScrollView showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {filtered.map((a) => {
              const isEnabled = a.enabled ? a.enabled(ctx) : true;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => run(a)}
                  onLongPress={() => toggleFavorite(a.id)}
                  style={{
                    width: '31%',
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: palette.divider,
                    backgroundColor: palette.surface,
                    paddingVertical: 12,
                    alignItems: 'center',
                    gap: 6,
                    opacity: isEnabled ? 1 : 0.5,
                  }}
                >
                  <KISIcon name={(a.icon ?? 'sparkles') as any} size={18} color={palette.primary} />
                  <Text
                    numberOfLines={2}
                    style={{ color: palette.text, fontSize: 11, fontWeight: '700', textAlign: 'center' }}
                  >
                    {favorites[a.id] ? '★ ' : ''}
                    {a.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {!!recents.length && (
        <View style={{ marginTop: 6 }}>
          <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
            Recent
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {recents.map((id) => {
              const a = actions.find((x) => x.id === id);
              if (!a) return null;
              return (
                <Pressable
                  key={id}
                  onPress={() => run(a)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 2,
                    borderColor: palette.divider,
                    backgroundColor: palette.card,
                  }}
                >
                  <Text style={{ color: palette.text, fontWeight: '700', fontSize: 12 }}>
                    {a.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
