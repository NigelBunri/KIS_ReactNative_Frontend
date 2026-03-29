// src/screens/tabs/profile/profile.types.ts
export type ProfilePayload = {
  user: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
    phone?: string | null;
    phone_country_code?: string | null;
    phone_number?: string | null;
    country?: string | null;
    email?: string | null;
  };
  profile: {
    id?: string;
    avatar_url?: string | null;
    cover_url?: string | null;
    headline?: string | null;
    bio?: string | null;
    industry?: string | null;
    completion_score?: number;
    branding_prefs?: Record<string, any>;
  };
  sections: {
    experiences?: any[];
    educations?: any[];
    skills?: any[];
    projects?: any[];
    recommendations?: any[];
    articles?: any[];
    activity?: any[];
    showcases?: Record<string, any[]>;
  };
  preferences?: {
    id?: string;
    services?: any[];
    availability?: Record<string, any>;
    skill_badges?: any[];
    languages?: any[];
    location?: Record<string, any>;
    compensation?: Record<string, any>;
    social_proof?: Record<string, any>;
    ask_tags?: string[];
    highlights?: string[];
  };
  stats?: Record<string, number>;
  tier?: any;
  subscription?: any;
  account?: {
    tier?: any;
    subscription?: any;
    wallet_balance_cents?: number;
    credits?: number;
    credits_value_cents?: number;
    points?: number;
  };
  partner_profiles?: Array<{
    id: string;
    name?: string;
    slug?: string;
    avatar_url?: string | null;
    is_active?: boolean;
    created_at?: string;
  }>;
  partner_profiles_count?: number;
  partner_profiles_limit_value?: number | null;
  partner_profiles_limit_label?: string | null;
  partner_profiles_is_unlimited?: boolean;
  partner_profiles_can_create?: boolean;
  privacy?: any[];
  tiers?: any[];
};

export type SheetType = 'editProfile' | 'privacy' | 'editItem' | 'upgrade' | 'partner' | 'wallet';

export type ItemType =
  | 'experience'
  | 'education'
  | 'project'
  | 'skill'
  | 'article'
  | 'portfolio'
  | 'case_study'
  | 'testimonial'
  | 'certification'
  | 'intro_video'
  | 'highlight'
  | 'service'
  | 'availability'
  | 'language'
  | 'location'
  | 'compensation'
  | 'ask_tag'
  | 'social_proof'
  | 'skill_badge';

export type PickedImage = { uri: string; name: string; type: string };

export type DraftProfile = {
  display_name: string;
  country_code: string;
  phone_number: string;
  languages: string[];
  headline: string;
  bio: string;
  industry: string;
  avatar_url: string;
  cover_url: string;
  avatar_file?: PickedImage | null;
  cover_file?: PickedImage | null;
  avatar_preview?: string;
  cover_preview?: string;
};

export type PrefsDraft = {
  services: any[];
  availability: Record<string, any>;
  skill_badges: any[];
  languages: any[];
  location: Record<string, any>;
  compensation: Record<string, any>;
  social_proof: Record<string, any>;
  ask_tags: string[];
  highlights: string[];
};
