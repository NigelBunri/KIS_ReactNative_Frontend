export type EducationLesson = {
  id: string;
  title?: string;
  summary?: string;
  lesson_url?: string;
  lesson_type?: 'partner' | 'community' | 'global' | string;
  partner_name?: string | null;
  community_name?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  price_cents?: number | null;
  currency?: string | null;
  public_info?: Record<string, any> | null;
};

export type EducationCourse = {
  id: string;
  partner?: string | null;
  partner_name?: string | null;
  title?: string;
  subtitle?: string;
  description?: string;
  cover_image?: string | null;
  cover_url?: string | null;
  level?: string;
  duration_minutes?: number;
  is_bible_course?: boolean;
  is_free?: boolean;
  is_public?: boolean;
  price_amount?: number | null;
  price_currency?: string | null;
  created_at?: string;
  source?: string;
  is_custom?: boolean;
  metadata?: Record<string, any>;
};

export type EducationModule = {
  id: string;
  title?: string;
  summary?: string;
  resource_url?: string | null;
};

export type EducationHomePayload = {
  featured: EducationLesson | null;
  live_lessons: EducationLesson[];
  popular_courses: EducationCourse[];
  modules: EducationModule[];
  categories: { id: string; name: string; icon?: string }[];
};

export const normalizeHome = (data: any): EducationHomePayload => {
  const d = data ?? {};
  return {
    featured: d.featured ?? null,
    live_lessons: Array.isArray(d.live_lessons) ? d.live_lessons : [],
    popular_courses: Array.isArray(d.popular_courses) ? d.popular_courses : [],
    modules: Array.isArray(d.modules) ? d.modules : [],
    categories: Array.isArray(d.categories) ? d.categories : [],
  };
};
