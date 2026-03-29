import React from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import type { InsightTopItem } from '@/api/insights/types';
import { useKISTheme } from '@/theme/useTheme';

type Props = {
  title: string;
  items: InsightTopItem[];
};

export default function TopItemsList({ title, items }: Props) {
  const { palette } = useKISTheme();
  if (!items.length) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: palette.primarySoft }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text style={[styles.subtitle, { color: palette.subtext }]} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
            {item.metric ? (
              <Text style={[styles.metric, { color: palette.primaryStrong }]} numberOfLines={1}>
                {item.metric}
              </Text>
            ) : null}
          </View>
        )}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
  },
  name: {
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
  },
  metric: {
    fontWeight: '700',
  },
});
