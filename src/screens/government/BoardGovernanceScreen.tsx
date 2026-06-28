import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';

type Props = NativeStackScreenProps<RootStackParamList, 'BoardGovernance'>;

type Candidate = {
  name: string;
  bio?: string;
};

type Election = {
  id: string;
  title: string;
  candidates: Candidate[];
  is_active: boolean;
  user_voted?: boolean;
};

type Resolution = {
  id: string;
  title: string;
  date: string;
  passed: boolean;
  votes_for?: number;
  votes_against?: number;
  votes_abstain?: number;
};

export default function BoardGovernanceScreen(_props: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const gutter = layout.pageGutter;

  const [activeTab, setActiveTab] = useState<'elections' | 'resolutions'>(
    'elections',
  );
  const [elections, setElections] = useState<Election[]>([]);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCandidates, setSelectedCandidates] = useState<
    Record<string, number>
  >({});
  const [voting, setVoting] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([
        getRequest(ROUTES.government.elections).catch(() => null),
        getRequest(ROUTES.government.resolutions).catch(() => null),
      ]).then(([electionsRes, resolutionsRes]) => {
        if (!active) return;
        setElections(
          Array.isArray(electionsRes)
            ? electionsRes
            : electionsRes?.results ?? [],
        );
        setResolutions(
          Array.isArray(resolutionsRes)
            ? resolutionsRes
            : resolutionsRes?.results ?? [],
        );
      }).finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  async function handleVote(electionId: string) {
    const candidateIndex = selectedCandidates[electionId];
    if (candidateIndex === undefined) {
      Alert.alert('Select Candidate', 'Please select a candidate to vote for.');
      return;
    }
    setVoting(electionId);
    try {
      await postRequest(ROUTES.government.electionVote(electionId), {
        candidate_index: candidateIndex,
      });
      setElections((prev) =>
        prev.map((e) =>
          e.id === electionId ? { ...e, user_voted: true } : e,
        ),
      );
      Alert.alert('Vote Recorded', 'Your vote has been cast successfully.');
    } catch {
      Alert.alert('Error', 'Could not submit vote. Please try again.');
    } finally {
      setVoting(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
      {/* Tab Bar */}
      <View
        style={[
          styles.tabBar,
          {
            borderBottomColor: palette.divider,
            paddingHorizontal: gutter,
          },
        ]}
      >
        {(['elections', 'resolutions'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.tab,
              activeTab === tab && {
                borderBottomColor: palette.primary,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === tab ? palette.primary : palette.subtext,
                },
              ]}
            >
              {tab === 'elections' ? 'Elections' : 'Resolutions'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: 14,
          paddingBottom: 80,
        }}
      >
        {activeTab === 'elections' ? (
          elections.length === 0 ? (
            <View style={styles.emptyState}>
              <KISIcon name="people-circle-outline" size={52} color={palette.subtext} />
              <Text style={[styles.emptyText, { color: palette.subtext }]}>
                No active elections
              </Text>
            </View>
          ) : (
            elections.map((election) => (
              <View
                key={election.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.divider,
                    marginBottom: layout.cardGap,
                  },
                ]}
              >
                <View style={styles.electionHeaderRow}>
                  <Text style={[styles.electionTitle, { color: palette.text }]}>
                    {election.title}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: election.is_active
                          ? palette.primary + '22'
                          : palette.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color: election.is_active
                            ? palette.primary
                            : palette.subtext,
                        },
                      ]}
                    >
                      {election.is_active ? 'Active' : 'Closed'}
                    </Text>
                  </View>
                </View>

                {election.user_voted ? (
                  <View
                    style={[
                      styles.votedNote,
                      { backgroundColor: palette.primarySoft },
                    ]}
                  >
                    <KISIcon
                      name="checkmark-circle-outline"
                      size={16}
                      color={palette.primary}
                    />
                    <Text
                      style={[styles.votedNoteText, { color: palette.primary }]}
                    >
                      You have voted in this election
                    </Text>
                  </View>
                ) : (
                  <>
                    {election.candidates.map((candidate, idx) => (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.75}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        style={[
                          styles.candidateRow,
                          {
                            borderColor:
                              selectedCandidates[election.id] === idx
                                ? palette.primary
                                : palette.divider,
                            backgroundColor:
                              selectedCandidates[election.id] === idx
                                ? palette.primarySoft
                                : palette.surface,
                          },
                        ]}
                        onPress={() =>
                          setSelectedCandidates((prev) => ({
                            ...prev,
                            [election.id]: idx,
                          }))
                        }
                      >
                        <View
                          style={[
                            styles.radio,
                            {
                              borderColor:
                                selectedCandidates[election.id] === idx
                                  ? palette.primary
                                  : palette.subtext,
                            },
                          ]}
                        >
                          {selectedCandidates[election.id] === idx && (
                            <View
                              style={[
                                styles.radioDot,
                                { backgroundColor: palette.primary },
                              ]}
                            />
                          )}
                        </View>
                        <View style={styles.candidateInfo}>
                          <Text
                            style={[
                              styles.candidateName,
                              { color: palette.text },
                            ]}
                          >
                            {candidate.name}
                          </Text>
                          {candidate.bio ? (
                            <Text
                              style={[
                                styles.candidateBio,
                                { color: palette.subtext },
                              ]}
                              numberOfLines={2}
                            >
                              {candidate.bio}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    ))}
                    {election.is_active && (
                      <KISButton
                        title={
                          voting === election.id ? 'Submitting…' : 'Cast Vote'
                        }
                        onPress={() => handleVote(election.id)}
                        disabled={
                          voting === election.id ||
                          selectedCandidates[election.id] === undefined
                        }
                        style={{ marginTop: 12 }}
                      />
                    )}
                  </>
                )}
              </View>
            ))
          )
        ) : resolutions.length === 0 ? (
          <View style={styles.emptyState}>
            <KISIcon
              name="document-outline"
              size={52}
              color={palette.subtext}
            />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              No resolutions recorded
            </Text>
          </View>
        ) : (
          resolutions.map((resolution) => {
            const total =
              (resolution.votes_for ?? 0) +
              (resolution.votes_against ?? 0) +
              (resolution.votes_abstain ?? 0);
            return (
              <View
                key={resolution.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.divider,
                    marginBottom: layout.cardGap,
                  },
                ]}
              >
                <View style={styles.resolutionHeaderRow}>
                  <Text
                    style={[
                      styles.resolutionTitle,
                      { color: palette.text, flex: 1 },
                    ]}
                  >
                    {resolution.title}
                  </Text>
                  <View
                    style={[
                      styles.passedBadge,
                      {
                        backgroundColor: resolution.passed
                          ? palette.primary + '22'
                          : palette.danger + '22',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.passedBadgeText,
                        {
                          color: resolution.passed
                            ? palette.primary
                            : palette.danger,
                        },
                      ]}
                    >
                      {resolution.passed ? 'Passed' : 'Not Passed'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.resolutionDate, { color: palette.subtext }]}>
                  {new Date(resolution.date).toLocaleDateString()}
                </Text>

                {total > 0 && (
                  <View style={styles.voteResults}>
                    <View style={styles.voteResultItem}>
                      <KISIcon
                        name="thumbs-up-outline"
                        size={14}
                        color={palette.primary}
                      />
                      <Text
                        style={[
                          styles.voteResultText,
                          { color: palette.primary },
                        ]}
                      >
                        {resolution.votes_for ?? 0} For
                      </Text>
                    </View>
                    <View style={styles.voteResultItem}>
                      <KISIcon
                        name="thumbs-down-outline"
                        size={14}
                        color={palette.danger}
                      />
                      <Text
                        style={[
                          styles.voteResultText,
                          { color: palette.danger },
                        ]}
                      >
                        {resolution.votes_against ?? 0} Against
                      </Text>
                    </View>
                    {(resolution.votes_abstain ?? 0) > 0 && (
                      <View style={styles.voteResultItem}>
                        <KISIcon
                          name="remove-circle-outline"
                          size={14}
                          color={palette.subtext}
                        />
                        <Text
                          style={[
                            styles.voteResultText,
                            { color: palette.subtext },
                          ]}
                        >
                          {resolution.votes_abstain} Abstain
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    minHeight: 44,
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  electionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  electionTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  votedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 10,
  },
  votedNoteText: {
    fontSize: 13,
    fontWeight: '600',
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    minHeight: 48,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  candidateInfo: {
    flex: 1,
    gap: 3,
  },
  candidateName: {
    fontSize: 14,
    fontWeight: '600',
  },
  candidateBio: {
    fontSize: 12,
    lineHeight: 17,
  },
  resolutionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  resolutionTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  passedBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  passedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resolutionDate: {
    fontSize: 12,
  },
  voteResults: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  voteResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voteResultText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
});
