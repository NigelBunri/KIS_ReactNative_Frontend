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

type Props = NativeStackScreenProps<RootStackParamList, 'CivicPolls'>;

type PollOption = {
  key: string;
  label: string;
  vote_count?: number;
};

type Poll = {
  id: string;
  question: string;
  options: PollOption[];
  is_closed: boolean;
  total_votes?: number;
  user_vote?: string | null;
};

export default function CivicPollsScreen(_props: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const gutter = layout.pageGutter;

  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [voting, setVoting] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.government.polls)
        .then((res: any) => {
          if (!active) return;
          setPolls(Array.isArray(res) ? res : res?.results ?? []);
        })
        .catch(() => setPolls([]))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const displayed = polls.filter((p) =>
    activeTab === 'active' ? !p.is_closed : p.is_closed,
  );

  async function handleVote(pollId: string) {
    const optionKey = selectedOptions[pollId];
    if (!optionKey) {
      Alert.alert('Select an option', 'Please select an option before voting.');
      return;
    }
    setVoting(pollId);
    try {
      await postRequest(ROUTES.government.pollVote(pollId), {
        option_key: optionKey,
      });
      setPolls((prev) =>
        prev.map((p) => {
          if (p.id !== pollId) return p;
          return {
            ...p,
            user_vote: optionKey,
            total_votes: (p.total_votes ?? 0) + 1,
            options: p.options.map((o) =>
              o.key === optionKey
                ? { ...o, vote_count: (o.vote_count ?? 0) + 1 }
                : o,
            ),
          };
        }),
      );
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
      {/* Tabs */}
      <View
        style={[
          styles.tabBar,
          {
            borderBottomColor: palette.divider,
            paddingHorizontal: gutter,
          },
        ]}
      >
        {(['active', 'closed'] as const).map((tab) => (
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
              {tab === 'active' ? 'Active' : 'Closed'}
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
        {displayed.length === 0 ? (
          <View style={styles.emptyState}>
            <KISIcon
              name="stats-chart-outline"
              size={52}
              color={palette.subtext}
            />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              No {activeTab} polls
            </Text>
          </View>
        ) : (
          displayed.map((poll) => (
            <View
              key={poll.id}
              style={[
                styles.card,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.divider,
                  marginBottom: layout.cardGap,
                },
              ]}
            >
              <Text style={[styles.question, { color: palette.text }]}>
                {poll.question}
              </Text>

              {!poll.is_closed ? (
                /* Active Poll: show result if already voted, otherwise show form */
                poll.user_vote ? (
                  <View style={[styles.alreadyVotedBadge, { backgroundColor: palette.successSoft, borderColor: palette.success }]}>
                    <KISIcon name="checkmark-circle" size={16} color={palette.success} />
                    <Text style={[styles.alreadyVotedText, { color: palette.success }]}>
                      You voted: {poll.options.find(o => o.key === poll.user_vote)?.label ?? poll.user_vote}
                    </Text>
                  </View>
                ) : (
                  <>
                  {poll.options.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      activeOpacity={0.75}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      style={[
                        styles.optionRow,
                        {
                          borderColor:
                            selectedOptions[poll.id] === opt.key
                              ? palette.primary
                              : palette.divider,
                          backgroundColor:
                            selectedOptions[poll.id] === opt.key
                              ? palette.primarySoft
                              : palette.surface,
                        },
                      ]}
                      onPress={() =>
                        setSelectedOptions((prev) => ({
                          ...prev,
                          [poll.id]: opt.key,
                        }))
                      }
                    >
                      <View
                        style={[
                          styles.radio,
                          {
                            borderColor:
                              selectedOptions[poll.id] === opt.key
                                ? palette.primary
                                : palette.subtext,
                          },
                        ]}
                      >
                        {selectedOptions[poll.id] === opt.key && (
                          <View
                            style={[
                              styles.radioDot,
                              { backgroundColor: palette.primary },
                            ]}
                          />
                        )}
                      </View>
                      <Text style={[styles.optionLabel, { color: palette.text }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <KISButton
                    title={voting === poll.id ? 'Submitting…' : 'Vote'}
                    onPress={() => handleVote(poll.id)}
                    disabled={voting === poll.id || !selectedOptions[poll.id]}
                    style={{ marginTop: 12 }}
                  />
                  </>
                )
              ) : (
                /* Closed Poll: bar chart */
                <>
                  {poll.options.map((opt) => {
                    const total = poll.total_votes ?? 1;
                    const count = opt.vote_count ?? 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <View key={opt.key} style={styles.resultRow}>
                        <View style={styles.resultLabelRow}>
                          <Text
                            style={[
                              styles.resultLabel,
                              { color: palette.text },
                            ]}
                          >
                            {opt.label}
                          </Text>
                          <Text
                            style={[
                              styles.resultPct,
                              { color: palette.subtext },
                            ]}
                          >
                            {pct}% ({count})
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.resultBarBg,
                            { backgroundColor: palette.surface },
                          ]}
                        >
                          <View
                            style={[
                              styles.resultBarFill,
                              {
                                backgroundColor: palette.primary,
                                width: `${pct}%`,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                  {poll.total_votes !== undefined && (
                    <Text
                      style={[styles.totalVotes, { color: palette.subtext }]}
                    >
                      {poll.total_votes.toLocaleString()} total votes
                    </Text>
                  )}
                </>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alreadyVotedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  alreadyVotedText: { fontSize: 14, fontWeight: '600', flex: 1 },
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
  },
  question: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    minHeight: 44,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionLabel: {
    fontSize: 14,
    flex: 1,
  },
  resultRow: {
    marginBottom: 10,
  },
  resultLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  resultPct: {
    fontSize: 13,
  },
  resultBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  resultBarFill: {
    height: 8,
    borderRadius: 4,
  },
  totalVotes: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
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
