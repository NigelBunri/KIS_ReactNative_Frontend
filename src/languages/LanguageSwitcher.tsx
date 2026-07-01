import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { useLanguage, useTranslation } from './index';

type Props = {
  /** Controlled visibility — pass to drive the modal from a parent button */
  visible?: boolean;
  onClose?: () => void;
};

export default function LanguageSwitcher({ visible: controlledVisible, onClose }: Props = {}) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const { language, languages, setLanguage, downloadingLanguage } = useLanguage();
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = controlledVisible !== undefined ? controlledVisible : internalOpen;
  const close = () => {
    setInternalOpen(false);
    onClose?.();
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={[styles.card, { backgroundColor: palette.card, maxWidth: responsive.contentMaxWidth }]} onPress={() => {}}>
          <Text style={[styles.title, { color: palette.text }]}>
            {t('Choose language')}
          </Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            {t('Switch the app language for supported text.')}
          </Text>

          {languages.map(entry => {
            const selected = entry.code === language;
            const downloading = entry.code === downloadingLanguage;
            return (
              <Pressable
                key={entry.code}
                disabled={downloading}
                onPress={() => {
                  setLanguage(entry.code)
                    .then(() => close())
                    .catch(() => {
                      Alert.alert(
                        t('Download failed'),
                        t("Couldn't download this language. Check your connection and try again."),
                      );
                    });
                }}
                style={[
                  styles.option,
                  {
                    borderColor: selected ? palette.primary : palette.border,
                    backgroundColor: selected
                      ? palette.surfaceElevated
                      : palette.surface,
                  },
                ]}
              >
                <View style={styles.optionLeft}>
                  {downloading ? (
                    <ActivityIndicator size="small" color={palette.primary} style={styles.flagIndicator} />
                  ) : (
                    <Text style={styles.flag}>{entry.flagEmoji}</Text>
                  )}
                  <Text style={[styles.optionLabel, { color: palette.text }]}>
                    {entry.nativeName}
                  </Text>
                </View>
                <Text style={[styles.optionCode, { color: palette.subtext }]}>
                  {entry.code.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}

          <Pressable onPress={close} style={styles.closeButton}>
            <Text style={[styles.closeLabel, { color: palette.primaryStrong }]}>
              {t('Close')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
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
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flagIndicator: {
    width: 22,
    height: 22,
  },
  flag: {
    fontSize: 22,
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
