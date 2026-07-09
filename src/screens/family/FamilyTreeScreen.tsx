import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'FamilyTree'>;

type TreeMember = {
  id: string;
  display_name: string;
  role: string;
  initials?: string;
  children?: TreeMember[];
};

type TreeData = {
  roots: TreeMember[];
};

function MemberNode({ member, palette, depth = 0 }: { member: TreeMember; palette: any; depth?: number }) {
  const hasChildren = member.children && member.children.length > 0;
  const initials = member.initials ?? (member.display_name?.[0] ?? '?').toUpperCase();

  return (
    <View style={[styles.nodeContainer, { marginLeft: depth > 0 ? 28 : 0 }]}>
      {/* Connector line from parent */}
      {depth > 0 && (
        <View style={[styles.connectorH, { borderColor: palette.divider }]} />
      )}

      <View style={styles.nodeRow}>
        {/* Vertical connector if has children */}
        {hasChildren && (
          <View style={[styles.connectorV, { borderColor: palette.divider }]} />
        )}
        <View style={[styles.nodeCard, { backgroundColor: palette.card, borderColor: palette.divider }]}>
          <View style={[styles.nodeAvatar, { backgroundColor: palette.primaryStrong }]}>
            <Text style={[styles.nodeInitials, { color: palette.ivory }]}>{initials}</Text>
          </View>
          <View style={styles.nodeInfo}>
            <Text style={[styles.nodeName, { color: palette.text }]} numberOfLines={1}>
              {member.display_name}
            </Text>
            <Text style={[styles.nodeRole, { color: palette.subtext }]}>
              {member.role ?? 'Member'}
            </Text>
          </View>
        </View>
      </View>

      {/* Children */}
      {hasChildren && (
        <View style={styles.childrenContainer}>
          {member.children!.map((child) => (
            <MemberNode key={child.id} member={child} palette={palette} depth={depth + 1} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function FamilyTreeScreen({ route, navigation }: Props) {
  const { familyId } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.family.accountTree(familyId))
        .then((res: any) => {
          if (!active) return;
          // Accept either { roots: [...] } or a flat array
          if (Array.isArray(res)) {
            setTreeData({ roots: res });
          } else if (res?.roots) {
            setTreeData(res);
          } else {
            setTreeData({ roots: [] });
          }
        })
        .catch(() => setTreeData({ roots: [] }))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [familyId]),
  );

  const gutter = layout.pageGutter;
  const roots = treeData?.roots ?? [];

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 80 }}
        horizontal={false}
      >
        <Text style={[styles.screenTitle, { color: palette.text }]}>Family Tree</Text>

        {roots.length === 0 ? (
          <View style={styles.emptyState}>
            <KISIcon name="git-network-outline" size={48} color={palette.subtext} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No tree data</Text>
            <Text style={[styles.emptySubtitle, { color: palette.subtext }]}>
              Family members will appear here once added.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.treeRoot}>
              {roots.map((root) => (
                <MemberNode key={root.id} member={root} palette={palette} />
              ))}
            </View>
          </ScrollView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenTitle: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  treeRoot: { paddingBottom: 24 },
  nodeContainer: { marginBottom: 8 },
  nodeRow: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  connectorH: {
    position: 'absolute',
    left: -28,
    top: '50%',
    width: 24,
    borderTopWidth: 2,
  },
  connectorV: {
    position: 'absolute',
    left: 20,
    bottom: -8,
    width: 2,
    height: 16,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
  },
  nodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 10,
    minWidth: 160,
    maxWidth: 220,
  },
  nodeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeInitials: { fontSize: 16, fontWeight: '700' },
  nodeInfo: { flex: 1 },
  nodeName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  nodeRole: { fontSize: 12 },
  childrenContainer: { marginTop: 8, paddingLeft: 20, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: '#ccc' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
});
