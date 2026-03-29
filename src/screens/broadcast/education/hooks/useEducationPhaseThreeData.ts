import { useCallback, useEffect, useState } from 'react';

import { getRequest } from '@/network/get';
import ROUTES from '@/network';

export type EducationCredential = {
  id: string;
  badgeName: string;
  issuedAt?: string | null;
  shareToken?: string | null;
};

export type EducationWalletSnapshot = {
  balanceCents?: number | null;
  credits?: number | null;
  creditsValueCents?: number | null;
};

const normalizeCredential = (raw: any, index: number): EducationCredential => ({
  id: String(raw?.id ?? `credential-${index}`),
  badgeName: raw?.badge_name ?? 'Course certificate',
  issuedAt: raw?.issued_at ?? null,
  shareToken: raw?.share_token ?? null,
});

const normalizeWallet = (raw: any): EducationWalletSnapshot => {
  if (!raw) return {};
  return {
    balanceCents: Number(raw.wallet_balance_cents ?? raw.wallet_balance ?? raw.balance ?? 0),
    credits: Number(raw.credits ?? 0),
    creditsValueCents: Number(raw.credits_value_cents ?? raw.credits_value ?? 0),
  };
};

export default function useEducationPhaseThreeData() {
  const [credentials, setCredentials] = useState<EducationCredential[]>([]);
  const [walletSnapshot, setWalletSnapshot] = useState<EducationWalletSnapshot>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [certRes, walletRes] = await Promise.all([
        getRequest(ROUTES.bible.credentials, { errorMessage: 'Unable to load credentials.' }),
        getRequest(ROUTES.wallet.me, { errorMessage: 'Unable to load wallet.' }),
      ]);

      if (certRes.success) {
        const data: any[] = Array.isArray(certRes.data) ? certRes.data : certRes.data?.results ?? [];
        setCredentials(data.map((item, index) => normalizeCredential(item, index)));
      } else {
        setCredentials([]);
      }

      if (walletRes.success) {
        setWalletSnapshot(normalizeWallet(walletRes.data));
      } else {
        setWalletSnapshot({});
      }

      if (!certRes.success || !walletRes.success) {
        setError(
          certRes.success && walletRes.success
            ? null
            : certRes.message || walletRes.message || 'Unable to load Phase 3 data.',
        );
      } else {
        setError(null);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Unable to fetch education insights.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    credentials,
    walletSnapshot,
    loading,
    error,
    refresh: load,
  };
}
