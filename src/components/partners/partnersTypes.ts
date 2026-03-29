// src/screens/tabs/partnersTypes.ts
export type PartnerAdmin = {
  id: string;
  name?: string | null;
  initials?: string;
  position?: string;
  avatarUrl?: string | null;
};

export type PartnerApi = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  avatar_url?: string | null;
  is_active?: boolean;
  main_conversation_id?: string | null;
  role?: string | null;
  member_role?: string | null;
  access_level?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Partner = PartnerApi & {
  initials: string;
  tagline: string;
  admins: PartnerAdmin[];
};

export type PartnerJoinConfig = {
  allow_public_listing?: boolean;
  allow_apply?: boolean;
  allow_subscribe?: boolean;
  auto_approve?: boolean;
  require_profile?: boolean;
  methods?: string[];
  criteria?: Record<string, any>;
  updated_at?: string;
};

export type PartnerDiscover = PartnerApi & {
  description?: string | null;
  main_conversation_id?: string | null;
  join_config?: PartnerJoinConfig | null;
  membership_status?: string | null;
  application_status?: string | null;
};

export type PartnerJobPost = {
  id: string | number;
  partner: string;
  title: string;
  description?: string | null;
  requirements?: string | null;
  steps?: string[];
  auto_assign?: {
    communities?: string[];
    groups?: string[];
    channels?: string[];
  };
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type PartnerGroup = {
  id: string;
  name: string;
  partner?: string | null;
  community?: string | null;
  channel?: string | null;
  conversation_id?: string | null;
};

export type PartnerChannel = {
  id: string;
  name: string;
  partner?: string | null;
  community?: string | null;
  conversation_id?: string | null;
};

export type PartnerCommunity = {
  id: string;
  name: string;
  description?: string | null;
  avatar_url?: string | null;
  partner?: string | null;
  main_conversation_id?: string | null;
  posts_conversation_id?: string | null;
};

export type PartnerPost = {
  id: string;
  partner: string;
  author?: {
    id?: string;
    display_name?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  };
  text?: string | null;
  styled_text?: any;
  attachments?: any[];
  poll?: any;
  event?: any;
  link?: string | null;
  reactions?: { emoji: string; count: number }[];
  comments_count?: number;
  has_reacted?: boolean;
  comment_conversation_id?: string | null;
  created_at?: string;
};

export type PartnerPolicySettings = {
  security?: {
    require_mfa?: boolean;
    session_timeout_minutes?: number;
    allow_external_sharing?: boolean;
  };
  compliance?: {
    audit_enabled?: boolean;
    legal_hold_enabled?: boolean;
  };
  retention?: {
    message_retention_days?: number;
    file_retention_days?: number;
  };
  dlp?: {
    enabled?: boolean;
    block_patterns?: string[];
    warn_patterns?: string[];
  };
  data_residency?: {
    region?: string;
    allow_cross_region?: boolean;
  };
  automation?: {
    webhooks_enabled?: boolean;
    event_triggers?: string[];
  };
  rate_limits?: {
    messages_per_minute?: number;
    uploads_per_hour?: number;
  };
  integrations?: {
    sso_required?: boolean;
    scim_enabled?: boolean;
    api_access_enabled?: boolean;
  };
};

export type PartnerPolicy = {
  id: string | number;
  partner: string;
  settings?: PartnerPolicySettings;
  updated_at?: string;
};

export type PartnerAuditEvent = {
  id: string | number;
  partner: string;
  actor?: string | null;
  actor_name?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  metadata?: Record<string, any>;
  created_at?: string;
};

export const LEFT_RAIL_WIDTH = 72;
export const RIGHT_PEEK_WIDTH = 72;
