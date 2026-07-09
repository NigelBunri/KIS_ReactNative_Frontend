import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { KISPalette } from '@/theme/constants';
import { KISIcon, type KISIconName } from '@/constants/kisIcons';
import { walletModes } from '../profile/profile.constants';
import { styles } from '../profile/profile.styles';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

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
  navigation?: any;
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

function getCategoryStyle(category: string, palette: KISPalette) {
  const map: Record<string, { bg: string; text: string }> = {
    profile:    { bg: palette.primarySoft ?? palette.surface, text: palette.primary },
    engagement: { bg: `${palette.gold}22`, text: palette.gold },
    market:     { bg: `${palette.success}22`, text: palette.success },
    community:  { bg: `${palette.primaryStrong}22`, text: palette.primaryStrong },
    education:  { bg: `${palette.danger}22`, text: palette.danger },
    broadcast:  { bg: `${palette.gold}18`, text: palette.gold },
    partner:    { bg: palette.primarySoft ?? palette.surface, text: palette.primary },
    health:     { bg: `${palette.danger}18`, text: palette.danger },
  };
  return map[category] ?? { bg: palette.primarySoft, text: palette.primaryStrong };
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
      <Text style={{ color: palette.onPrimary, fontSize: 11, fontWeight: '900' }}>+{points} pts</Text>
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
        <Text style={{ color: palette.ivory, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.75 }}>
          Your reward points
        </Text>
        <Text style={{ color: palette.onPrimary, fontSize: 48, fontWeight: '900', marginTop: 4, lineHeight: 54 }}>
          {points.toLocaleString()}
        </Text>
        {data?.tier ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <KISIcon name="star" size={14} color={palette.ivory} />
            <Text style={{ color: palette.ivory, fontSize: 13, fontWeight: '700' }}>
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
          <View style={{ flex: 1, minWidth: 120, backgroundColor: palette.primaryWeak, borderRadius: 12, padding: 12 }}>
            <Text style={{ color: palette.onPrimary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tier upgrade</Text>
            <Text style={{ color: palette.onPrimary, fontSize: 20, fontWeight: '900', marginTop: 2 }}>{tierUpgradeDiscount}% off</Text>
            <Text style={{ color: palette.ivory, fontSize: 10, marginTop: 2, opacity: 0.75 }}>current value</Text>
          </View>
          <View style={{ flex: 1, minWidth: 120, backgroundColor: palette.primaryWeak, borderRadius: 12, padding: 12 }}>
            <Text style={{ color: palette.onPrimary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Artist booking</Text>
            <Text style={{ color: palette.onPrimary, fontSize: 20, fontWeight: '900', marginTop: 2 }}>{artistDiscount}% off</Text>
            <Text style={{ color: palette.ivory, fontSize: 10, marginTop: 2, opacity: 0.75 }}>current value</Text>
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
              minHeight: 44,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: section === s ? palette.primary : palette.surface,
              borderWidth: 1,
              borderColor: section === s ? palette.primary : palette.divider,
            }}
          >
            <Text style={{ color: section === s ? palette.onPrimary : palette.subtext, fontSize: 12, fontWeight: '700' }}>
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
                    <Text style={{ color: palette.success, fontSize: 11, fontWeight: '700' }}>
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
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();

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
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      ListEmptyComponent={
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
          <Text style={{ color: palette.subtext, fontSize: 14, textAlign: 'center' }}>
            No transactions yet
          </Text>
        </View>
      }
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
                  color: item.status === 'paid' ? palette.success : palette.subtext,
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

// ─── Deposit Panel ────────────────────────────────────────────────────────────
function DepositPanel({ palette }: { palette: KISPalette }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDeposit = async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid deposit amount.');
      return;
    }
    setLoading(true);
    try {
      await postRequest(ROUTES.wallet.deposit, { amount: parsed, currency: 'NGN' }, {
        errorMessage: 'Deposit failed',
      });
      Alert.alert('Deposit submitted', `Your deposit of ₦${parsed.toFixed(2)} has been initiated.`);
      setAmount('');
    } catch (err: any) {
      Alert.alert('Deposit failed', err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>Deposit funds</Text>
      <Text style={{ color: palette.subtext, fontSize: 12, lineHeight: 17 }}>
        Add funds to your KIS wallet in NGN. Funds will be available immediately after processing.
      </Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="Amount (NGN)"
        placeholderTextColor={palette.subtext}
        keyboardType="numeric"
        style={{
          borderWidth: 1,
          borderColor: palette.divider,
          borderRadius: 10,
          padding: 12,
          color: palette.text,
          backgroundColor: palette.surface,
          fontSize: 15,
        }}
      />
      <Pressable
        onPress={handleDeposit}
        disabled={loading}
        style={{
          backgroundColor: palette.primary,
          borderRadius: 10,
          padding: 14,
          alignItems: 'center',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading
          ? <ActivityIndicator color={palette.onPrimary} />
          : <Text style={{ color: palette.onPrimary, fontWeight: '800', fontSize: 14 }}>Deposit</Text>
        }
      </Pressable>
    </View>
  );
}

// ─── Transfer Panel ───────────────────────────────────────────────────────────
function TransferPanel({ palette }: { palette: KISPalette }) {
  const [toWalletId, setToWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    const parsed = parseFloat(amount);
    if (!toWalletId.trim()) {
      Alert.alert('Missing recipient', 'Please enter a recipient wallet ID.');
      return;
    }
    if (!amount || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid transfer amount.');
      return;
    }
    setLoading(true);
    try {
      await postRequest(ROUTES.wallet.transfer, { to_wallet_id: toWalletId.trim(), amount: parsed }, {
        errorMessage: 'Transfer failed',
      });
      Alert.alert('Transfer sent', `₦${parsed.toFixed(2)} has been sent successfully.`);
      setToWalletId('');
      setAmount('');
    } catch (err: any) {
      Alert.alert('Transfer failed', err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>Transfer funds</Text>
      <Text style={{ color: palette.subtext, fontSize: 12, lineHeight: 17 }}>
        Send funds from your KIS wallet to another wallet using their wallet ID.
      </Text>
      <TextInput
        value={toWalletId}
        onChangeText={setToWalletId}
        placeholder="Recipient wallet ID"
        placeholderTextColor={palette.subtext}
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: palette.divider,
          borderRadius: 10,
          padding: 12,
          color: palette.text,
          backgroundColor: palette.surface,
          fontSize: 14,
        }}
      />
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="Amount (NGN)"
        placeholderTextColor={palette.subtext}
        keyboardType="numeric"
        style={{
          borderWidth: 1,
          borderColor: palette.divider,
          borderRadius: 10,
          padding: 12,
          color: palette.text,
          backgroundColor: palette.surface,
          fontSize: 15,
        }}
      />
      <Pressable
        onPress={handleTransfer}
        disabled={loading}
        style={{
          backgroundColor: palette.primary,
          borderRadius: 10,
          padding: 14,
          alignItems: 'center',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading
          ? <ActivityIndicator color={palette.onPrimary} />
          : <Text style={{ color: palette.onPrimary, fontWeight: '800', fontSize: 14 }}>Transfer</Text>
        }
      </Pressable>
    </View>
  );
}

// ─── Convert Panel ────────────────────────────────────────────────────────────
const CURRENCY_OPTIONS = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES'];

function ConvertPanel({ palette }: { palette: KISPalette }) {
  const [amount, setAmount] = useState('');
  const [fromCurrency, setFromCurrency] = useState('NGN');
  const [toCurrency, setToCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount to convert.');
      return;
    }
    if (fromCurrency === toCurrency) {
      Alert.alert('Same currency', 'Please choose different currencies to convert between.');
      return;
    }
    setLoading(true);
    try {
      await postRequest(ROUTES.wallet.convert, { amount: parsed, from_currency: fromCurrency, to_currency: toCurrency }, {
        errorMessage: 'Conversion failed',
      });
      Alert.alert('Conversion initiated', `Converting ${parsed.toFixed(2)} ${fromCurrency} → ${toCurrency}. Check your balance shortly.`);
      setAmount('');
    } catch (err: any) {
      Alert.alert('Conversion failed', err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>Convert currency</Text>
      <Text style={{ color: palette.subtext, fontSize: 12, lineHeight: 17 }}>
        Convert between currencies in your KIS wallet at the current exchange rate.
      </Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="Amount"
        placeholderTextColor={palette.subtext}
        keyboardType="numeric"
        style={{
          borderWidth: 1,
          borderColor: palette.divider,
          borderRadius: 10,
          padding: 12,
          color: palette.text,
          backgroundColor: palette.surface,
          fontSize: 15,
        }}
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>From</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {CURRENCY_OPTIONS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setFromCurrency(c)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: fromCurrency === c ? palette.primary : palette.surface,
                  borderWidth: 1,
                  borderColor: fromCurrency === c ? palette.primary : palette.divider,
                }}
              >
                <Text style={{ color: fromCurrency === c ? palette.onPrimary : palette.text, fontSize: 12, fontWeight: '700' }}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>To</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {CURRENCY_OPTIONS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setToCurrency(c)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: toCurrency === c ? palette.primaryStrong : palette.surface,
                  borderWidth: 1,
                  borderColor: toCurrency === c ? palette.primaryStrong : palette.divider,
                }}
              >
                <Text style={{ color: toCurrency === c ? palette.onPrimary : palette.text, fontSize: 12, fontWeight: '700' }}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <Pressable
        onPress={handleConvert}
        disabled={loading}
        style={{
          backgroundColor: palette.primary,
          borderRadius: 10,
          padding: 14,
          alignItems: 'center',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading
          ? <ActivityIndicator color={palette.onPrimary} />
          : <Text style={{ color: palette.onPrimary, fontWeight: '800', fontSize: 14 }}>Convert {fromCurrency} → {toCurrency}</Text>
        }
      </Pressable>
    </View>
  );
}

// ─── Upgrade Panel ────────────────────────────────────────────────────────────
function UpgradePanel({ palette, navigation }: { palette: KISPalette; navigation?: any }) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await postRequest(ROUTES.wallet.upgrade, {}, {
        errorMessage: 'Could not initiate upgrade',
      });
      if (navigation) {
        navigation.navigate('SubscriptionManagement');
      } else {
        Alert.alert('Upgrade', res?.data?.message ?? 'Upgrade initiated. Visit the subscription screen to complete.');
      }
    } catch (err: any) {
      Alert.alert('Upgrade failed', err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>Upgrade your tier</Text>
      <Text style={{ color: palette.subtext, fontSize: 12, lineHeight: 17 }}>
        Unlock premium features by upgrading your KIS account tier. Higher tiers give you access to advanced analytics, extended storage, and partner tools.
      </Text>
      <View
        style={{
          backgroundColor: palette.primarySoft,
          borderRadius: 14,
          padding: 16,
          gap: 8,
        }}
      >
        {(['Pro', 'Business', 'Enterprise'] as const).map((tier) => (
          <View key={tier} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <KISIcon name="checkmark-circle" size={16} color={palette.primaryStrong} />
            <Text style={{ color: palette.text, fontSize: 13, fontWeight: '600' }}>{tier} tier available</Text>
          </View>
        ))}
      </View>
      <Pressable
        onPress={handleUpgrade}
        disabled={loading}
        style={{
          backgroundColor: palette.primary,
          borderRadius: 10,
          padding: 14,
          alignItems: 'center',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading
          ? <ActivityIndicator color={palette.onPrimary} />
          : <Text style={{ color: palette.onPrimary, fontWeight: '800', fontSize: 14 }}>View upgrade options</Text>
        }
      </Pressable>
    </View>
  );
}

export function WalletModal(props: WalletModalProps) {
  const {
    palette,
    walletForm,
    setWalletForm,
    navigation,
  } = props;

  const mode = String(walletForm.mode || 'history').trim().toLowerCase();

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
      {mode === 'deposit' && <DepositPanel palette={palette} />}
      {mode === 'transfer' && <TransferPanel palette={palette} />}
      {mode === 'convert' && <ConvertPanel palette={palette} />}
      {mode === 'upgrade' && <UpgradePanel palette={palette} navigation={navigation} />}

      {!['loyalty', 'invoices', 'deposit', 'transfer', 'convert', 'upgrade'].includes(mode) && (
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
      )}
    </View>
  );
}
