import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';

type Props = {
  palette: any;
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  methodFilter: string | null;
  onMethodFilter: (value: string | null) => void;
  openOnly: boolean;
  onToggleOpen: () => void;
  methods: Array<{ key: string; label: string }>;
};

export default function PartnerDiscoveryFilters({
  palette,
  query,
  onQueryChange,
  onSearch,
  methodFilter,
  onMethodFilter,
  openOnly,
  onToggleOpen,
  methods,
}: Props) {
  return (
    <>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 12,
            borderWidth: 2,
            borderColor: palette.borderMuted,
            backgroundColor: palette.surface,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          <KISIcon name="search" size={16} color={palette.subtext} />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            onSubmitEditing={onSearch}
            placeholder="Search partner names, tags, roles"
            placeholderTextColor={palette.subtext}
            style={{ marginLeft: 8, color: palette.text, flex: 1, fontSize: 14 }}
          />
          <Pressable onPress={onSearch}>
            <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>
              Go
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ paddingHorizontal: 12, paddingTop: 10 , maxHeight: 40}}
      >
        <Pressable
          onPress={onToggleOpen}
          style={({ pressed }) => ({
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: palette.borderMuted,
            backgroundColor: openOnly ? palette.primarySoft : 'transparent',
            marginRight: 8,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: palette.text, fontSize: 12, fontWeight: '600' }}>
            Open now
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onMethodFilter(null)}
          style={({ pressed }) => ({
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: palette.borderMuted,
            backgroundColor: methodFilter ? 'transparent' : palette.primarySoft,
            marginRight: 8,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: palette.text, fontSize: 12, fontWeight: '600' }}>
            All
          </Text>
        </Pressable>
        {methods.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => onMethodFilter(item.key)}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: palette.borderMuted,
              backgroundColor: methodFilter === item.key ? palette.primarySoft : 'transparent',
              marginRight: 8,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: palette.text, fontSize: 12, fontWeight: '600' }}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}
