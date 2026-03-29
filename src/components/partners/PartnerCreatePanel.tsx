import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import styles from '@/components/partners/partnersStyles';
import NewCommunityForm from '@/Module/AddContacts/components/NewCommunityForm';
import NewGroupForm from '@/Module/AddContacts/components/NewGroupForm';
import NewChannelForm from '@/Module/AddContacts/components/NewChannelForm';

export type PartnerCreateKind = 'community' | 'group' | 'channel' | null;

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  kind: PartnerCreateKind;
  partnerId?: string | null;
  onClose: () => void;
  onSwitchKind: (next: PartnerCreateKind) => void;
  onCreated: () => void;
};

export default function PartnerCreatePanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  kind,
  partnerId,
  onClose,
  onSwitchKind,
  onCreated,
}: Props) {
  const { palette } = useKISTheme();
  const [groupName, setGroupName] = useState('');
  const [groupSlug, setGroupSlug] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  useEffect(() => {
    if (!kind) return;
    setGroupName('');
    setGroupSlug('');
    setGroupDescription('');
    setSelectedChannelId(null);
  }, [kind]);

  const title = useMemo(() => {
    if (kind === 'community') return 'Create partner community';
    if (kind === 'group') return 'Create partner group';
    if (kind === 'channel') return 'Create partner channel';
    return 'Create';
  }, [kind]);

  if (!isOpen || !kind) return null;

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.settingsPanelBackdrop,
          { backgroundColor: palette.backdrop, opacity: backdropOpacity },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          {
            width: panelWidth,
            backgroundColor: palette.surfaceElevated,
            borderLeftColor: palette.divider,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        <View
          style={[
            styles.settingsPanelHeader,
            { borderBottomColor: palette.divider },
          ]}
        >
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              {title}
            </Text>
            <Text
              style={[
                styles.settingsPanelDescription,
                { color: palette.subtext },
              ]}
            >
              This will be created under the current partner account.
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.settingsPanelBody}
          showsVerticalScrollIndicator={false}
        >
          {kind === 'community' ? (
            <NewCommunityForm
              palette={palette}
              onSuccess={() => {
                Alert.alert('Partner', 'Community created.');
                onCreated();
                onClose();
              }}
              selectedMemberIds={[]}
              onSelectMembers={() => {}}
              showMemberPicker={false}
              partnerId={partnerId}
            />
          ) : null}

          {kind === 'channel' ? (
            <NewChannelForm
              palette={palette}
              partnerId={partnerId}
              onSuccess={() => {
                Alert.alert('Partner', 'Channel created.');
                onCreated();
                onClose();
              }}
            />
          ) : null}

          {kind === 'group' ? (
            <NewGroupForm
              palette={palette}
              onSuccess={() => {
                Alert.alert('Partner', 'Group created.');
                onCreated();
                onClose();
              }}
              selectedMemberIds={[]}
              onSelectMembers={() => {}}
              showMemberPicker={false}
              communityId={null}
              communityName={null}
              initialChannelId={null}
              onCreateChannel={() => onSwitchKind('channel')}
              name={groupName}
              slug={groupSlug}
              description={groupDescription}
              selectedChannelId={selectedChannelId}
              onChangeName={setGroupName}
              onChangeSlug={setGroupSlug}
              onChangeDescription={setGroupDescription}
              onChangeChannelId={setSelectedChannelId}
              partnerId={partnerId}
            />
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
