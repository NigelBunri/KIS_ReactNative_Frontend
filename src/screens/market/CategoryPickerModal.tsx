import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import type { FixedCategoryOption } from '@/screens/market/market.constants';

type CategoryPickerModalProps = {
  visible: boolean;
  title: string;
  description?: string;
  categories: FixedCategoryOption[];
  selectedIds: string[];
  selectionLimit: number;
  onSelect: (categoryId: string) => void;
  onClose: () => void;
};

export default function CategoryPickerModal({
  visible,
  title,
  description,
  categories,
  selectedIds = [],
  selectionLimit,
  onSelect,
  onClose,
}: CategoryPickerModalProps) {
  const { palette } = useKISTheme();
  const normalizedSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];
  const limitReached = normalizedSelectedIds.length >= selectionLimit;
  const sortedCategories = [...categories].sort((left, right) => {
    const leftOrder = Number(left.sort_order ?? 0);
    const rightOrder = Number(right.sort_order ?? 0);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left.name ?? '').localeCompare(String(right.name ?? ''));
  });
  const topLevelCategories = sortedCategories.filter((category) => !category.parent_id);
  const childCategories = sortedCategories.filter((category) => category.parent_id);
  const childMap = new Map<string, FixedCategoryOption[]>();
  childCategories.forEach((category) => {
    const parentId = String(category.parent_id);
    const existing = childMap.get(parentId) ?? [];
    existing.push(category);
    childMap.set(parentId, existing);
  });

  const renderOption = (category: FixedCategoryOption, nested = false) => {
    const isSelected = normalizedSelectedIds.includes(category.id);
    const disabled = !isSelected && limitReached;
    return (
      <Pressable
        key={category.id}
        style={[
          styles.option,
          nested ? styles.nestedOption : null,
          {
            borderColor: palette.divider,
            backgroundColor: isSelected ? `${palette.primary}15` : palette.surface,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
        disabled={disabled}
        onPress={() => onSelect(category.id)}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionText, { color: palette.text }]}>{category.name}</Text>
          <Text
            style={[
              styles.optionHint,
              { color: isSelected ? palette.primaryStrong : palette.subtext },
            ]}
          >
            {isSelected
              ? 'Already added'
              : disabled
                ? 'Selection limit reached'
                : 'Tap to add this category'}
          </Text>
        </View>
        {isSelected ? (
          <KISIcon name="check" size={18} color={palette.primaryStrong} />
        ) : null}
      </Pressable>
    );
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrapper} pointerEvents={visible ? 'auto' : 'none'}>
        <Pressable
          style={[styles.overlay, { backgroundColor: palette.background }]}
          onPress={onClose}
        />
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
            {normalizedSelectedIds.length}/{selectionLimit} selected
            </Text>
          </View>
          {description ? (
            <Text style={[styles.description, { color: palette.subtext }]}>{description}</Text>
          ) : null}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {topLevelCategories.map((category) => {
              const children = childMap.get(category.id) ?? [];
              if (!children.length) {
                return renderOption(category);
              }
              return (
                <View key={category.id} style={styles.group}>
                  <Text style={[styles.groupTitle, { color: palette.text }]}>{category.name}</Text>
                  {category.description ? (
                    <Text style={[styles.groupDescription, { color: palette.subtext }]}>
                      {category.description}
                    </Text>
                  ) : null}
                  {renderOption(category)}
                  {children.map((child) => renderOption(child, true))}
                </View>
              );
            })}
          </ScrollView>
          <View style={styles.actions}>
            <KISButton title="Close" size="sm" variant="ghost" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    width: '100%',
    maxHeight: '80%',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
    marginTop: 8,
  },
  list: {
    marginTop: 12,
  },
  listContent: {
    paddingBottom: 8,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  nestedOption: {
    marginLeft: 14,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionHint: {
    fontSize: 11,
    marginTop: 2,
  },
  actions: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  group: {
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 11,
    marginBottom: 8,
  },
});
