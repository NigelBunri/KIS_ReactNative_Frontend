import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import type { KISPalette } from '@/theme/constants';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import { walletModes } from '../profile/profile.constants';
import { styles } from '../profile/profile.styles';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

type WalletModalProps = {
  palette: KISPalette;
  walletForm: Record<string, any>;
  setWalletForm: React.Dispatch<React.SetStateAction<any>>;
  setWalletRecipient?: (value: string) => void;
  walletRecipientVerification?: {
    checking: boolean;
    verified: boolean;
    recipientName: string;
    recipientPhoneDisplay: string;
    error: string;
  };
  verifyWalletRecipient?: () => Promise<void>;
  saving: boolean;
  submitWalletAction?: () => Promise<void>;
  lastWalletPaymentUrl?: string;
};

type EarningRule = {
  key: string;
  title: string;
  description: string;
  points: number;
  category: string;
  icon: string;
  repeatable: boolean;
};

type RedemptionOption = {
  key: string;
  title: string;
  description: string;
  points_per_unit: number;
  discount_value: string;
  max_discount_percent: number;
  icon: string;
};

type HistoryEntry = {
  id: string;
  points: number;
  reason: string;
  earned_at: string;
  expires_at?: string | null;
};

type LoyaltyData = {
  points: number;
  tier?: string | null;
  earning_rules: EarningRule[];
  redemption_options: RedemptionOption[];
  recent_history: HistoryEntry[];
};

type Invoice = {
  id: string;
  amount: number | string;
  currency?: string;
  status?: string;
  created_at?: string;
  description?: string;
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  profile:    { bg: '#e0f2fe', text: '#0369a1' },
  engagement: { bg: '#fef3c7', text: '#92400e' },
  market:     { bg: '#dcfce7', text: '#166534' },
  community:  { bg: '#f3e8ff', text: '#6b21a8' },
  education:  { bg: '#fce7f3', text: '#9d174d' },
  broadcast:  { bg: '#fff7ed', text: '#9a3412' },
  partner:    { bg: '#e0e7ff', text: '#3730a3' },
  health:     { bg: '#fee2e2', text: '#991b1b' },
};

function getCategoryStyle(category: string, palette: KISPalette) {
  return CATEGORY_COLORS[category] ?? { bg: palette.primarySoft, text: palette.primaryStrong };
}

function PointsBadge({ points, palette }: { points: number; palette: KISPalette }) {
  return (
    <View
      style={{
        backgroundColor: palette.primary,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>+{points} pts</Text>
    </View>
  );
}

function LoyaltyPanel({ palette }: { palette: KISPalette }) {
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState<'earn' | 'spend' | 'history'>('earn');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.billing.loyaltyBalance, {
        errorMessage: 'Could not load rewards data',
      });
      setData(res?.data ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <ActivityIndicator color={palette.primary} style={{ marginVertical: 24 }} />;
  }

  const points = data?.points ?? 0;
  const earningRules = data?.earning_rules ?? [];
  const redemptionOptions = data?.redemption_options ?? [];
  const recentHistory = data?.recent_history ?? [];

  const tierUpgradeDiscount = Math.min(Math.floor(points / 100), 50);
  const artistDiscount = Math.min(Math.floor(points / 50), 30);

  return (
    <View style={{ gap: 14 }}>
      {/* Balance hero */}
      <View
        style={{
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: palette.primary,
          padding: 20,
        }}
      >
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
          Your reward points
        </Text>
        <Text style={{ color: '#fff', fontSize: 48, fontWeight: '900', marginTop: 4, lineHeight: 54 }}>
          {points.toLocaleString()}
        </Text>
        {data?.tier ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <KISIcon name="star" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' }}>
              {data.tier} tier
            </Text>
          </View>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            marginTop: 16,
            flexWrap: 'wrap',
          }}
        >
          <View style={{ flex: 1, minWidth: 120, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12 }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tier upgrade</Text>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 2 }}>{tierUpgradeDiscount}% off</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, marginTop: 2 }}>current value</Text>
          </View>
          <View style={{ flex: 1, minWidth: 120, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12 }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Artist booking</Text>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 2 }}>{artistDiscount}% off</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, marginTop: 2 }}>current value</Text>
          </View>
        </View>
      </View>

      {/* Section tabs */}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(['earn', 'spend', 'history'] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSection(s)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              alignItems: 'center',
              backgroundColor: section === s ? palette.primary : palette.surface,
              borderWidth: 1,
              borderColor: section === s ? palette.primary : palette.divider,
            }}
          >
            <Text style={{ color: section === s ? '#fff' : palette.subtext, fontSize: 12, fontWeight: '700' }}>
              {s === 'earn' ? 'How to earn' : s === 'spend' ? 'How to spend' : 'History'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Earn section */}
      {section === 'earn' && (() => {
        const FALLBACK_RULES: EarningRule[] = [
          { key: 'profile_complete', title: 'Complete your profile', description: 'Fill in all fields and add a photo', points: 50, category: 'profile', icon: 'person', repeatable: false },
          { key: 'daily_login', title: 'Daily app engagement', description: 'Open and actively use the app each day', points: 5, category: 'engagement', icon: 'calendar', repeatable: true },
          { key: 'first_purchase', title: 'First marketplace purchase', description: 'Complete your first order', points: 100, category: 'market', icon: 'cart', repeatable: false },
          { key: 'first_booking', title: 'Book a service or artist', description: 'Book for the first time', points: 75, category: 'market', icon: 'bookmark', repeatable: false },
          { key: 'leave_review', title: 'Leave a review', description: 'Write a genuine review after purchase', points: 30, category: 'community', icon: 'star', repeatable: true },
          { key: 'invite_friend', title: 'Invite a friend', description: 'Refer a friend who joins KIS', points: 200, category: 'community', icon: 'people', repeatable: true },
          { key: 'education_course', title: 'Complete a course', description: 'Finish any education course', points: 150, category: 'education', icon: 'school', repeatable: true },
          { key: 'broadcast_post', title: 'Share quality content', description: 'Post engaging content to your broadcast', points: 20, category: 'broadcast', icon: 'megaphone', repeatable: true },
          { key: 'partner_active', title: 'Active partner organisation', description: 'Keep your org active and in good standing', points: 100, category: 'partner', icon: 'business', repeatable: true },
          { key: 'health_activity', title: 'Log a health activity', description: 'Record a health check or appointment', points: 15, category: 'health', icon: 'heart', repeatable: true },
        ];
        const rules = earningRules.length > 0 ? earningRules : FALLBACK_RULES;
        return (
        <View style={{ gap: 8 }}>
          <Text style={{ color: palette.subtext, fontSize: 12, lineHeight: 17 }}>
            Points are awarded for positive behaviour on KIS — being active, contributing to the community, completing your profile, and supporting the platform.
          </Text>
          {rules.map((rule) => {
            const colStyle = getCategoryStyle(rule.category, palette);
            return (
              <View
                key={rule.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  backgroundColor: palette.surface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: palette.divider,
                  padding: 12,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: colStyle.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <KISIcon name={rule.icon as KISIconName} size={20} color={colStyle.text} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ color: palette.text, fontSize: 13, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>
                      {rule.title}
                    </Text>
                    <PointsBadge points={rule.points} palette={palette} />
                  </View>
                  <Text style={{ color: palette.subtext, fontSize: 12, lineHeight: 16 }} numberOfLines={2}>
                    {rule.description}
                  </Text>
                  {rule.repeatable ? (
                    <Text style={{ color: palette.primaryStrong, fontSize: 10, fontWeight: '700' }}>Repeatable</Text>
                  ) : (
                    <Text style={{ color: palette.subtext, fontSize: 10 }}>One-time</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
        );
      })()}

      {/* Spend section */}
      {section === 'spend' && (() => {
        const FALLBACK_REDEMPTIONS: RedemptionOption[] = [
          {
            key: 'tier_upgrade',
            title: 'Upgrade your account tier',
            description: 'Use points to reduce the cost of upgrading to a higher KIS account tier. Every 100 points = 1% off, up to 50% discount.',
            points_per_unit: 100,
            discount_value: '1% off tier upgrade price',
            max_discount_percent: 50,
            icon: 'arrow-up-circle',
          },
          {
            key: 'artist_discount',
            title: 'Artist & creator discount',
            description: 'Redeem points to reduce the cost of booking artists, musicians, or creators through the KIS marketplace. Every 50 points = 1% off, up to 30% discount.',
            points_per_unit: 50,
            discount_value: '1% off artist booking price',
            max_discount_percent: 30,
            icon: 'musical-notes',
          },
        ];
        const opts = redemptionOptions.length > 0 ? redemptionOptions : FALLBACK_REDEMPTIONS;
        return (
        <View style={{ gap: 10 }}>
          <Text style={{ color: palette.subtext, fontSize: 12, lineHeight: 17 }}>
            Your points have real value. Use them to reduce costs on the platform — whether you want to upgrade your account or work with artists and creators.
          </Text>
          {opts.map((opt) => {
            const myDiscount = opt.key === 'tier_upgrade' ? tierUpgradeDiscount : artistDiscount;
            const ptsNeededForMax = opt.max_discount_percent * opt.points_per_unit;
            const ptsToNext = Math.max(0, opt.points_per_unit - (points % opt.points_per_unit));
            return (
              <View
                key={opt.key}
                style={{
                  backgroundColor: palette.surface,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: palette.primary + '44',
                  padding: 16,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: palette.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <KISIcon name={opt.icon as KISIconName} size={22} color={palette.primaryStrong} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text, fontSize: 14, fontWeight: '900' }}>{opt.title}</Text>
                    <Text style={{ color: palette.primaryStrong, fontSize: 12, fontWeight: '700', marginTop: 1 }}>
                      {opt.discount_value}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: palette.subtext, fontSize: 12, lineHeight: 17 }}>
                  {opt.description}
                </Text>
                {/* Progress toward discount */}
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: palette.text, fontSize: 13, fontWeight: '800' }}>
                      Your current discount: {myDiscount}%
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>
                      max {opt.max_discount_percent}%
                    </Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: palette.divider, borderRadius: 999, overflow: 'hidden' }}>
                    <View
                      style={{
                        width: `${Math.min(100, (myDiscount / opt.max_discount_percent) * 100)}%`,
                        height: '100%',
                        backgroundColor: palette.primary,
                        borderRadius: 999,
                      }}
                    />
                  </View>
                  {myDiscount < opt.max_discount_percent ? (
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>
                      {ptsToNext > 0
                        ? `${ptsToNext} more pts to unlock next 1% off`
                        : `${ptsNeededForMax - points} pts away from max ${opt.max_discount_percent}% discount`}
                    </Text>
                  ) : (
                    <Text style={{ color: palette.success ?? '#22c55e', fontSize: 11, fontWeight: '700' }}>
                      Maximum discount unlocked!
                    </Text>
                  )}
                </View>
                <View
                  style={{
                    backgroundColor: palette.primarySoft,
                    borderRadius: 10,
                    padding: 10,
                    gap: 2,
                  }}
                >
                  <Text style={{ color: palette.primaryStrong, fontSize: 11, fontWeight: '800' }}>
                    How redemption works
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 11, lineHeight: 15 }}>
                    Your discount is automatically applied when you upgrade your tier or book an artist. No manual redemption needed — your points work for you in the background.
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
        );
      })()}

      {/* History section */}
      {section === 'history' && (
        <View style={{ gap: 8 }}>
          {recentHistory.length === 0 ? (
            <View
              style={{
                padding: 24,
                alignItems: 'center',
                backgroundColor: palette.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: palette.divider,
              }}
            >
              <KISIcon name="time" size={32} color={palette.subtext} />
              <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 18 }}>
                No points earned yet.{'\n'}Start earning by completing your profile and engaging with the platform.
              </Text>
            </View>
          ) : (
            recentHistory.map((entry) => (
              <View
                key={entry.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: palette.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: palette.divider,
                  padding: 12,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: palette.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <KISIcon name="star" size={18} color={palette.primaryStrong} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                    {entry.reason || 'Points awarded'}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>
                    {new Date(entry.earned_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 15 }}>
                  +{entry.points}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

function InvoicesPanel({ palette }: { palette: KISPalette }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.billing.invoices, { errorMessage: 'Could not load invoices' });
      const list: Invoice[] = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setInvoices(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <ActivityIndicator color={palette.primary} style={{ marginVertical: 16 }} />;
  }

  if (invoices.length === 0) {
    return (
      <Text style={{ color: palette.subtext, fontSize: 13, textAlign: 'center', marginVertical: 16 }}>
        No invoices yet.
      </Text>
    );
  }

  return (
    <FlatList
      data={invoices}
      keyExtractor={(inv) => inv.id}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <View
          style={{
            borderWidth: 1,
            borderColor: palette.divider,
            backgroundColor: palette.surface,
            borderRadius: 10,
            padding: 12,
            marginBottom: 8,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: palette.text, fontSize: 14, fontWeight: '600' }}>
              {item.currency ?? ''} {item.amount}
            </Text>
            {item.status && (
              <Text
                style={{
                  color: item.status === 'paid' ? '#22c55e' : palette.subtext,
                  fontSize: 12,
                  fontWeight: '600',
                  textTransform: 'capitalize',
                }}
              >
                {item.status}
              </Text>
            )}
          </View>
          {item.description && (
            <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {item.description}
            </Text>
          )}
          {item.created_at && (
            <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          )}
        </View>
      )}
    />
  );
}

export function WalletModal(props: WalletModalProps) {
  const {
    palette,
    walletForm,
    setWalletForm,
  } = props;

  const mode = String(walletForm.mode || 'history').trim().toLowerCase();
  const legacyActionMode = ['deposit', 'cash_to_credits', 'transfer'].includes(mode) || mode === `add_${'kisc'}`;

  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.subtext, { color: palette.subtext }]}>
        Promotional credits
      </Text>

      <View style={styles.walletModeRow}>
        {[...walletModes, { value: 'loyalty', label: 'Rewards' }, { value: 'invoices', label: 'Invoices' }].map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setWalletForm((s: any) => ({ ...s, mode: item.value }))}
            style={[
              styles.walletModeChip,
              {
                backgroundColor: walletForm.mode === item.value ? palette.primarySoft : palette.surface,
                borderColor: palette.divider,
              },
            ]}
          >
            <Text style={{ color: palette.text, fontSize: 12 }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'loyalty' && <LoyaltyPanel palette={palette} />}

      {mode === 'invoices' && <InvoicesPanel palette={palette} />}

      {mode !== 'loyalty' && mode !== 'invoices' && (
        legacyActionMode ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              backgroundColor: palette.surface,
              borderRadius: 12,
              padding: 12,
              gap: 6,
            }}
          >
            <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>
              This wallet action is unavailable
            </Text>
            <Text style={[styles.subtext, { color: palette.subtext }]}>Locked</Text>
          </View>
        ) : (
          <View
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              backgroundColor: palette.surface,
              borderRadius: 12,
              padding: 12,
              gap: 6,
            }}
          >
            <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>
              Read-only credit center
            </Text>
            <Text style={[styles.subtext, { color: palette.subtext }]}>
              Promotional credits can only subsidize eligible KIS account upgrades when that option is available.
            </Text>
          </View>
        )
      )}
    </View>
  );
}
