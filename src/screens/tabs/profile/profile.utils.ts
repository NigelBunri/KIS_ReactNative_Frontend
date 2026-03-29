export const makeUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8;
    return v.toString(16);
  });
};

export const formatMoney = (cents = 0) => {
  const value = Math.max(0, cents) / 100;
  return `${value.toFixed(2)}`;
};

export const parseCsv = (value: string | null | undefined): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export const tierMetaFor = (tier: any) => {
  const name = String(tier?.name ?? '').toLowerCase();
  const features = tier?.features_json ?? {};
  const addFeature = (text: string, list: string[]) => {
    if (text && !list.includes(text)) list.push(text);
  };
  const formatLimit = (value: any, fallback = 'Included') => {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'string') {
      const cleaned = value.trim();
      if (!cleaned) return fallback;
      if (cleaned.toLowerCase() === 'unlimited') return 'Unlimited';
      return cleaned;
    }
    if (typeof value === 'boolean') return value ? 'Included' : 'Not included';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value);
    return String(numeric);
  };
  const formatStorage = () => {
    const gb = features.storage_gb;
    if (gb !== undefined && gb !== null && gb !== '') {
      if (String(gb).toLowerCase() === 'unlimited') return 'Unlimited';
      return `${gb} GB`;
    }
    const mb = features.media_storage_mb;
    if (mb === undefined || mb === null || mb === '') return 'Included';
    if (String(mb).toLowerCase() === 'unlimited') return 'Unlimited';
    const numericMb = Number(mb);
    if (!Number.isFinite(numericMb)) return String(mb);
    const gbValue = numericMb / 1024;
    const rounded = Number.isInteger(gbValue) ? gbValue.toFixed(0) : gbValue.toFixed(1);
    return `${rounded} GB`;
  };

  let badge = tier?.feature_badge || '';
  let tagline = tier?.feature_tagline || 'Built for everyday growth';
  let list: string[] = Array.isArray(tier?.feature_list) ? [...tier.feature_list] : [];
  let highlight = tier?.feature_highlight || '';

  if (!list.length && name.includes('partner pro')) {
    tagline = 'Global partner networks & enterprise ops';
    badge = 'Partner Pro';
    highlight = 'Unlimited partner orgs + automation ops';
    list = [
      'Partner +',
      'Unlimited partner organizations',
      'Enterprise automation & API/webhooks',
      'Dedicated revenue & giving ops hub',
      'Advanced analytics & forecasting',
      'Priority compliance & governance controls',
      'Global roles & permission teams',
      'Concierge onboarding & migration',
      'Unlimited media limits',
      'Better groups, communities, channels, and feeds management',
      'Organizational management tools',
    ];
  } else if (!list.length && name.includes('partner')) {
    tagline = 'Organizations, ministries & enterprises';
    badge = 'Partner';
    highlight = 'Multi-account orgs + revenue tools';
    list = [
      'Business Pro +',
      'Verified organization profile',
      'Multiple admins & roles',
      'Live streaming + events',
      'Donations & revenue tools',
      'Advanced analytics dashboard',
      'Community & group management at scale',
      'Priority support',
      'Partner webhooks & automations',
      'Higher media limits (13 GB for broadcast feeds and profile gallery)',
      'Unlimited health profiles creation',
      'Unlimited education profiles creation',
    ];
  } else if (!list.length && name.includes('business pro')) {
    tagline = 'High-impact teams and creators';
    badge = 'Most popular';
    highlight = 'Advanced analytics + team workflows';
    list = [
      'Business +',
      'Unlimited communities & groups',
      'Team collaboration tools',
      'Advanced insights & reporting',
      'Priority moderation tools',
      'Limited health profiles creation (1)',
      'Limited education profiles creation (1)',
      'Higher media limits (10 GB for broadcast feeds, profile gallery, and market items)',
      'Unlimited market profile creation',
      'Branding controls',
      'Faster support response',
    ];
  } else if (!list.length && name.includes('business')) {
    tagline = 'Teams, growth & visibility';
    highlight = 'KIS Business broadcast + storefront';
    list = [
      'Pro +',
      'KIS Business broadcast channel',
      'Business profile + CTA buttons',
      'Multiple admins for business page',
      'Business insights & audience metrics',
      'Basic catalog for services/products',
      'Higher media limits (7 GB for broadcast feeds and profile gallery)',
      'Promo codes + offers',
      'Auto-reply & business hours',
      'Featured discovery boost',
    ];
  } else if (!list.length && name.includes('pro')) {
    tagline = 'Creators and power users';
    highlight = 'Enhanced profile + higher limits';
    list = [
      'Free +',
      'More communities & groups',
      'Enhanced profile visibility',
      'Higher media limits (5 GB for broadcast feeds and profile gallery)',
      'Advanced messaging tools',
      'Priority search ranking',
      'Extended support',
    ];
  } else if (!list.length) {
    tagline = 'Start free, upgrade anytime';
    highlight = 'Everything you need to begin';
    list = [
      'Direct messaging',
      'Core community access',
      'Standard profile',
      'Basic storage (1 GB for broadcast feeds and profile gallery)',
      'Search & discovery',
      'Standard support',
      'Limited community/group creation (create 1 community and 2 groups)',
    ];
  }

  addFeature(`Communities: ${formatLimit(features.communities)}`, list);
  addFeature(`Groups per community: ${formatLimit(features.groups_per_community)}`, list);
  addFeature(`Channels create: ${formatLimit(features.channels_create)}`, list);
  addFeature(`Storage: ${formatStorage()}`, list);
  if (features.partner_accounts !== undefined && features.partner_accounts !== null) {
    const raw = features.partner_accounts;
    const label =
      typeof raw === 'string'
        ? raw
        : Number.isNaN(Number(raw))
        ? String(raw)
        : String(raw);
    addFeature(`Partner accounts: ${label}`, list);
  }

  return { badge, tagline, highlight, features: list };
};
