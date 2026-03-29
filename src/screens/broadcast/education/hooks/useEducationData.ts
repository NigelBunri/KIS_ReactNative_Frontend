import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import {
  EducationCourse,
  EducationHomePayload,
  EducationModule,
} from '@/screens/broadcast/education/api/education.types';

type Params = { q?: string; activeProfileId?: string | null };

const DEFAULT_HOME: EducationHomePayload = {
  featured: null,
  live_lessons: [],
  popular_courses: [],
  modules: [],
  categories: [],
};

const toPrettyCategory = (raw: string | undefined) => {
  if (!raw) return 'General';
  const cleaned = raw.trim().replace(/[_-]+/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const buildCategories = (courses: EducationCourse[]) => {
  const seen = new Map<string, { id: string; name: string; icon?: string }>();
  courses.forEach((course) => {
    const level = (course.level ?? 'general').trim().toLowerCase() || 'general';
    if (!seen.has(level)) {
      seen.set(level, {
        id: level,
        name: toPrettyCategory(course.level ?? level),
        icon: 'book',
      });
    }
  });
  return Array.from(seen.values());
};

const unwrapList = (response: any) => {
  if (!response) return [];
  const payload = response?.data ?? response;
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
};

const generateId = () => `home-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeBibleCourse = (course: any): EducationCourse => ({
  id: String(course?.id ?? generateId()),
  partner: course?.partner ?? null,
  partner_name: course?.partner_name ?? course?.partner_display_name ?? null,
  title: course?.title,
  subtitle: course?.subtitle,
  description: course?.description,
  cover_image: course?.cover_image ?? course?.image ?? null,
  level: course?.level ?? 'general',
  duration_minutes: course?.duration_minutes,
  is_bible_course: Boolean(course?.is_bible_course),
  is_free: Boolean(course?.is_free),
  is_public: Boolean(course?.is_public),
  price_amount: course?.price_amount ?? null,
  price_currency: course?.price_currency ?? null,
  created_at: course?.created_at,
  source: 'bible_course',
});

const normalizeProfileCourse = (course: any): EducationCourse => ({
  id: String(course?.id ?? generateId()),
  title: course?.title,
  subtitle: course?.summary,
  description: course?.summary,
  cover_image: course?.cover_url ?? null,
  level: (course?.level ?? 'education').toLowerCase(),
  is_custom: true,
  source: 'education_profile',
});

const normalizeProfileModule = (module: any, index: number): EducationModule | null => {
  if (!module) return null;
  const title = (module?.title ?? '').trim();
  if (!title) return null;
  return {
    id: String(module?.id ?? `module-${generateId()}-${index}`),
    title,
    summary: module?.summary ?? module?.description ?? null,
    resource_url: module?.resource_url ?? module?.resourceUrl ?? null,
  };
};

export default function useEducationData({ q = '', activeProfileId = null }: Params) {
  const [home, setHome] = useState<EducationHomePayload>(DEFAULT_HOME);
  const [loading, setLoading] = useState(false);
  const [broadcastProfiles, setBroadcastProfiles] = useState<Record<string, any> | null>(null);
  const [activeEducationProfile, setActiveEducationProfile] = useState<any | null>(null);
  const mountedRef = useRef(true);

  const loadHome = useCallback(async () => {
    setLoading(true);
    const params = q?.trim() ? { q: q.trim() } : undefined;
    try {
      const [coursesRes, lessonsRes, profilesRes] = await Promise.all([
        getRequest(ROUTES.bible.courses, {
          params,
          errorMessage: 'Unable to load courses.',
        }),
        getRequest(ROUTES.broadcasts.lessons, {
          params,
          errorMessage: 'Unable to load lessons.',
        }),
        getRequest(ROUTES.broadcasts.createProfile, {
          errorMessage: 'Unable to load broadcast profiles.',
        }),
      ]);

      const bibleCourses = unwrapList(coursesRes);
      const lessons = unwrapList(lessonsRes);
      const educationProfiles = Array.isArray(profilesRes?.data?.profiles)
        ? profilesRes?.data?.profiles
        : [];
      const activeProfile =
        (activeProfileId && educationProfiles.find((profile: any) => profile.id === activeProfileId)) ??
        educationProfiles.find((profile: any) => profile.is_default) ??
        educationProfiles[0] ??
        null;
      const profileCourses = Array.isArray(activeProfile?.courses) ? activeProfile.courses : [];
      const profileModules = Array.isArray(activeProfile?.modules) ? activeProfile.modules : [];

      const combinedCourses = [
        ...profileCourses.map(normalizeProfileCourse),
        ...bibleCourses.map(normalizeBibleCourse),
      ];

      const normalizedModules = profileModules
        .map((mod: any, index: number) => normalizeProfileModule(mod, index))
        .filter((mod: EducationModule | null): mod is EducationModule => Boolean(mod));

      const profilesPayload = profilesRes?.data?.profiles ?? {};
      const next: EducationHomePayload = {
        featured: lessons[0] ?? null,
        live_lessons: lessons,
        popular_courses: combinedCourses,
        modules: normalizedModules,
        categories: buildCategories(combinedCourses),
      };

      if (mountedRef.current) {
        setHome(next);
        setBroadcastProfiles(profilesPayload);
        setActiveEducationProfile(activeProfile);
      }
    } catch (error: any) {
      console.log('[useEducationData] load failed', error?.message ?? error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [q, activeProfileId]);

  const enrollLesson = useCallback(async (lessonId: string) => {
    const res = await postRequest(ROUTES.broadcasts.lessonEnroll(lessonId), {}, {
      errorMessage: 'Unable to enroll in lesson.',
    });
    if (res?.success === false) return { ok: false };
    DeviceEventEmitter.emit('broadcast.refresh');
    return { ok: true };
  }, []);

  const updateCourse = useCallback((updated: EducationCourse) => {
    setHome((prev) => {
      const updatedCourses = (prev.popular_courses ?? []).map((course) =>
        course.id === updated.id ? { ...course, ...updated } : course,
      );
      return {
        ...prev,
        popular_courses: updatedCourses,
        categories: buildCategories(updatedCourses),
      };
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadHome();
    return () => {
      mountedRef.current = false;
    };
  }, [loadHome]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('broadcast.refresh', loadHome);
    return () => sub.remove();
  }, [loadHome]);

    return {
      home,
      loading,
      reload: loadHome,
      enrollLesson,
      updateCourse,
      broadcastProfiles,
      activeEducationProfile,
    };
  }
