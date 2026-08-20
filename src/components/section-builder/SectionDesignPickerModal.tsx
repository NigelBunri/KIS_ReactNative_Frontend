import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getSectionVariants, type SectionVariantOption, type SectionVariantPreviewShape } from './sectionVariants';

type Props = {
  visible: boolean;
  sectionType: string;
  selectedVariant?: string;
  onSelect: (variantKey: string) => void;
  onClose: () => void;
};

// Small structural mockup per preview shape — not a pixel-match of the
// live website CSS (SectionRenderer.tsx), just distinct enough at a
// glance that a user can tell the options apart before committing.
function VariantThumbnail({ shape, palette }: { shape: SectionVariantPreviewShape; palette: any }) {
  const imageBlock = (style: any) => (
    <LinearGradient
      colors={[palette.primarySoft ?? '#d9c48a', palette.primary ?? '#8a6a2a']}
      style={[styles.thumbImage, style]}
    />
  );
  const textLine = (style: any) => (
    <View style={[styles.thumbLine, { backgroundColor: palette.divider }, style]} />
  );

  switch (shape) {
    case 'hero_overlay':
      return (
        <View style={styles.thumbBox}>
          {imageBlock({ ...StyleSheet.absoluteFillObject, borderRadius: 8 })}
          <View style={styles.thumbCenter}>
            {textLine({ width: '55%', height: 6, backgroundColor: '#fff' })}
            {textLine({ width: '35%', marginTop: 4, backgroundColor: '#fff9' })}
          </View>
        </View>
      );
    case 'split_image_text':
      return (
        <View style={[styles.thumbBox, { flexDirection: 'row', gap: 4 }]}>
          {imageBlock({ flex: 1, borderRadius: 6 })}
          <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
            {textLine({ width: '80%' })}
            {textLine({ width: '55%' })}
          </View>
        </View>
      );
    case 'split_text_image':
      return (
        <View style={[styles.thumbBox, { flexDirection: 'row', gap: 4 }]}>
          <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
            {textLine({ width: '80%' })}
            {textLine({ width: '55%' })}
          </View>
          {imageBlock({ flex: 1, borderRadius: 6 })}
        </View>
      );
    case 'bottom_card':
      return (
        <View style={styles.thumbBox}>
          {imageBlock({ ...StyleSheet.absoluteFillObject, borderRadius: 8 })}
          <View style={[styles.thumbCard, { backgroundColor: palette.card }]}>
            {textLine({ width: '70%' })}
            {textLine({ width: '45%', marginTop: 3 })}
          </View>
        </View>
      );
    case 'minimal_strip':
      return (
        <View style={[styles.thumbBox, { justifyContent: 'flex-start', paddingTop: 4 }]}>
          {imageBlock({ height: '45%', width: '100%', borderRadius: 6 })}
          <View style={{ alignItems: 'center', marginTop: 6, gap: 4 }}>
            {textLine({ width: '50%' })}
            {textLine({ width: '35%' })}
          </View>
        </View>
      );
    case 'centered_stack':
      return (
        <View style={[styles.thumbBox, { alignItems: 'center', paddingTop: 6 }]}>
          {imageBlock({ width: 28, height: 28, borderRadius: 14 })}
          <View style={{ alignItems: 'center', marginTop: 6, gap: 4 }}>
            {textLine({ width: '55%' })}
            {textLine({ width: '40%' })}
          </View>
        </View>
      );
    case 'card_overlap':
      return (
        <View style={styles.thumbBox}>
          {imageBlock({ height: '65%', width: '100%', borderRadius: 6 })}
          <View style={[styles.thumbOverlapCard, { backgroundColor: palette.card }]}>
            {textLine({ width: '60%' })}
          </View>
        </View>
      );
    case 'bordered_quote':
      return (
        <View style={[styles.thumbBox, { flexDirection: 'row', gap: 6 }]}>
          <View style={[styles.thumbQuoteBar, { backgroundColor: palette.primary }]} />
          <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
            {textLine({ width: '75%' })}
            {textLine({ width: '50%' })}
          </View>
          {imageBlock({ width: 30, height: 30, borderRadius: 6 })}
        </View>
      );
    case 'full_banner':
    default:
      return (
        <View style={styles.thumbBox}>
          {imageBlock({ height: '60%', width: '100%', borderRadius: 6 })}
          <View style={{ marginTop: 6, gap: 4 }}>
            {textLine({ width: '70%' })}
            {textLine({ width: '45%' })}
          </View>
        </View>
      );
  }
}

// Design-picker for a single section — opened by the "Change Design"
// button on any section whose type has entries in SECTION_VARIANTS
// (sectionVariants.ts). Selecting an option sets the section's sibling
// `variant` field (not part of `data`), which both the RN preview and
// the live website's SectionRenderer.tsx read to decide which of that
// type's alternate layouts to render — see resolveVariant() there.
export default function SectionDesignPickerModal({ visible, sectionType, selectedVariant, onSelect, onClose }: Props) {
  const { palette } = useKISTheme();
  const options = getSectionVariants(sectionType) ?? [];
  const activeKey = selectedVariant || options[0]?.key;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrapper}>
        <Pressable style={[styles.overlay, { backgroundColor: palette.bg }]} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <Text style={[styles.title, { color: palette.text }]}>Choose a Design</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Pick how this section looks. Your choice replaces the default design everywhere this page is shown.
          </Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {options.map((option: SectionVariantOption) => {
              const isSelected = option.key === activeKey;
              return (
                <Pressable
                  key={option.key}
                  style={[
                    styles.option,
                    { borderColor: isSelected ? palette.primaryStrong : palette.divider, backgroundColor: isSelected ? `${palette.primary}12` : palette.card },
                  ]}
                  onPress={() => onSelect(option.key)}
                >
                  <VariantThumbnail shape={option.preview} palette={palette} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.optionTitle, { color: palette.text }]}>{option.label}</Text>
                      {isSelected ? <KISIcon name="check" size={16} color={palette.primaryStrong} /> : null}
                    </View>
                    <Text style={[styles.optionDescription, { color: palette.subtext }]}>{option.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.actions}>
            <KISButton title="Close" size="sm" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  overlay: { ...StyleSheet.absoluteFillObject, opacity: 0.85 },
  card: { borderRadius: 20, borderWidth: 1, width: '100%', maxHeight: '82%', padding: 16 },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  list: { marginTop: 12 },
  option: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, padding: 10, marginBottom: 10 },
  optionTitle: { fontSize: 14, fontWeight: '700' },
  optionDescription: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  actions: { marginTop: 4, alignItems: 'flex-end' },
  thumbBox: { width: 72, height: 56, borderRadius: 8, overflow: 'hidden', justifyContent: 'center', padding: 4, backgroundColor: '#00000008' },
  thumbImage: { position: 'absolute' },
  thumbLine: { height: 4, borderRadius: 2 },
  thumbCenter: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  thumbCard: { position: 'absolute', left: 4, right: 4, bottom: 4, borderRadius: 4, padding: 4 },
  thumbOverlapCard: { position: 'absolute', left: 4, right: 12, bottom: 0, borderRadius: 4, padding: 4 },
  thumbQuoteBar: { width: 3, borderRadius: 2, alignSelf: 'stretch' },
});
