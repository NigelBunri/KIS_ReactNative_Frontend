import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { PartnerJobPost } from '@/components/partners/partnersTypes';
import PartnerRecruitmentJobList from '@/components/partners/recruitment/PartnerRecruitmentJobList';
import PartnerRecruitmentForm from '@/components/partners/recruitment/PartnerRecruitmentForm';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  onClose: () => void;
};

type Option = { id: string; name: string };

const toggleId = (list: string[], id: string) =>
  list.includes(id) ? list.filter((value) => value !== id) : [...list, id];

export default function PartnerRecruitmentPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  partnerId,
  onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [jobs, setJobs] = useState<PartnerJobPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [communities, setCommunities] = useState<Option[]>([]);
  const [groups, setGroups] = useState<Option[]>([]);
  const [channels, setChannels] = useState<Option[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [assignCommunities, setAssignCommunities] = useState<string[]>([]);
  const [assignGroups, setAssignGroups] = useState<string[]>([]);
  const [assignChannels, setAssignChannels] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const steps = useMemo(
    () =>
      stepsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    [stepsText],
  );

  const loadJobs = useCallback(async () => {
    if (!partnerId) return;
    const res = await getRequest(ROUTES.partners.jobs(partnerId), {
      errorMessage: 'Unable to load jobs.',
    });
    const list = (res?.data ?? res ?? []) as PartnerJobPost[];
    setJobs(Array.isArray(list) ? list : []);
  }, [partnerId]);

  const loadSpaces = useCallback(async () => {
    if (!partnerId) return;
    const [communitiesRes, groupsRes, channelsRes] = await Promise.all([
      getRequest(`${ROUTES.community.list}?partner=${partnerId}`, {
        errorMessage: 'Unable to load communities.',
      }),
      getRequest(`${ROUTES.groups.list}?partner=${partnerId}`, {
        errorMessage: 'Unable to load groups.',
      }),
      getRequest(`${ROUTES.channels.getAllChannels}?partner=${partnerId}`, {
        errorMessage: 'Unable to load channels.',
      }),
    ]);
    const communityList = (communitiesRes?.data?.results ?? communitiesRes?.data ?? communitiesRes ?? []) as any[];
    const groupList = (groupsRes?.data?.results ?? groupsRes?.data ?? groupsRes ?? []) as any[];
    const channelList = (channelsRes?.data ?? channelsRes ?? []) as any[];
    setCommunities(
      Array.isArray(communityList)
        ? communityList.map((c) => ({ id: String(c.id), name: c.name || 'Community' }))
        : [],
    );
    setGroups(
      Array.isArray(groupList)
        ? groupList.map((g) => ({ id: String(g.id), name: g.name || 'Group' }))
        : [],
    );
    setChannels(
      Array.isArray(channelList)
        ? channelList.map((c) => ({ id: String(c.id), name: c.name || 'Channel' }))
        : [],
    );
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    Promise.all([loadJobs(), loadSpaces()])
      .finally(() => setLoading(false));
  }, [isOpen, loadJobs, loadSpaces]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setRequirements('');
    setStepsText('');
    setAssignCommunities([]);
    setAssignGroups([]);
    setAssignChannels([]);
  };

  const onCreateJob = async () => {
    if (!partnerId) return;
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please add a job title.');
      return;
    }
    setSubmitting(true);
    try {
      await postRequest(ROUTES.partners.jobs(partnerId), {
        title: title.trim(),
        description: description.trim(),
        requirements: requirements.trim(),
        steps,
        auto_assign: {
          communities: assignCommunities,
          groups: assignGroups,
          channels: assignChannels,
        },
        is_active: true,
      });
      Alert.alert('Job created', 'Recruitment pipeline saved.');
      resetForm();
      loadJobs();
    } catch (e: any) {
      Alert.alert('Create failed', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>
              Recruitment pipeline
            </Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              Define job posts, screening steps, and auto-assign onboarding.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={{ padding: 16 }}>
            <ActivityIndicator color={palette.primaryStrong} />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          >
            <PartnerRecruitmentJobList palette={palette} jobs={jobs} />
            <PartnerRecruitmentForm
              palette={palette}
              title={title}
              description={description}
              requirements={requirements}
              stepsText={stepsText}
              communities={communities}
              groups={groups}
              channels={channels}
              assignCommunities={assignCommunities}
              assignGroups={assignGroups}
              assignChannels={assignChannels}
              submitting={submitting}
              onChangeTitle={setTitle}
              onChangeDescription={setDescription}
              onChangeRequirements={setRequirements}
              onChangeStepsText={setStepsText}
              onToggleCommunity={(id) =>
                setAssignCommunities(toggleId(assignCommunities, id))
              }
              onToggleGroup={(id) => setAssignGroups(toggleId(assignGroups, id))}
              onToggleChannel={(id) =>
                setAssignChannels(toggleId(assignChannels, id))
              }
              onSubmit={onCreateJob}
            />
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}
