// src/screens/tabs/profile/components/SectionCard.tsx
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { ItemType } from '../profile.types';
import { styles } from '../profile.styles';

export default function SectionCard({
  title,
  type: _type,
  items,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  type: ItemType;
  items: any[];
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
}) {
  const { palette } = useKISTheme();

  return (
    <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.divider }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
        <Pressable onPress={onAdd}>
          <KISIcon name="add" size={20} color={palette.primaryStrong} />
        </Pressable>
      </View>

      {items.length === 0 ? (
        <Text style={[styles.subtext, { color: palette.subtext }]}>No items yet.</Text>
      ) : (
        items.map((item: any) => (
          <View key={item.id} style={[styles.itemRow, { borderBottomColor: palette.divider }]}>
            {item.file_url ? <Image source={{ uri: item.file_url }} style={styles.thumb} /> : null}

            <View style={styles.itemInfo}>
              <Text style={[styles.itemTitle, { color: palette.text }]}>
                {item.title || item.school || item.name}
              </Text>
              <Text style={[styles.subtext, { color: palette.subtext }]} numberOfLines={2}>
                {item.summary || item.description || item.payload?.note}
              </Text>
            </View>

            <View style={styles.rowActions}>
              <Pressable onPress={() => onEdit(item)}>
                <KISIcon name="edit" size={18} color={palette.subtext} />
              </Pressable>
              <Pressable onPress={() => onDelete(item.id)}>
                <KISIcon name="trash" size={18} color={palette.danger} />
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  );
}
