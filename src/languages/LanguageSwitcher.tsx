import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKISTheme } from '@/theme/useTheme';
import { useLanguage } from './index';

export default function LanguageSwitcher() {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const { language, languages, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  const activeLabel = useMemo(
    () => languages.find((entry) => entry.code === language)?.label ?? 'English',
    [language, languages],
  );

  return (
    <>
      {/* <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.fab,
          {
            top: insets.top + 8,
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
        ]}
      >
        <Text style={[styles.fabText, { color: palette.text }]}>
          {language.toUpperCase()}
        </Text>
      </Pressable> */}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: palette.card }]}>
            <Text style={[styles.title, { color: palette.text }]}>Choose language</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              Switch the app language for supported text.
            </Text>

            {languages.map((entry) => {
              const selected = entry.code === language;
              return (
                <Pressable
                  key={entry.code}
                  onPress={() => {
                    setLanguage(entry.code).catch(() => undefined);
                    setOpen(false);
                  }}
                  style={[
                    styles.option,
                    {
                      borderColor: selected ? palette.primary : palette.border,
                      backgroundColor: selected ? palette.surfaceElevated : palette.surface,
                    },
                  ]}
                >
                  <Text style={[styles.optionLabel, { color: palette.text }]}>{entry.label}</Text>
                  <Text style={[styles.optionCode, { color: palette.subtext }]}>
                    {entry.code.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable onPress={() => setOpen(false)} style={styles.closeButton}>
              <Text style={[styles.closeLabel, { color: palette.primaryStrong }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 12,
    zIndex: 1000,
    minWidth: 48,
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  option: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  optionCode: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    alignSelf: 'flex-end',
    paddingTop: 8,
  },
  closeLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});
