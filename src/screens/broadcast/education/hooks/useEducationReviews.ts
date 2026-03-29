import { useCallback, useEffect, useState } from 'react';

import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

export type EducationReview = {
  id: string;
  user_name?: string;
  content?: string;
  created_at?: string;
};

export default function useEducationReviews(courseId?: string) {
  const [reviews, setReviews] = useState<EducationReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!courseId) {
      setReviews([]);
      return;
    }
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.bible.courseComments, {
        params: { course: courseId },
        errorMessage: 'Unable to load reviews.',
      });
      if (res.success) {
        const data = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.results)
            ? res.data.results
            : [];
        setReviews(data.map((item: any) => ({
          id: String(item.id),
          user_name: item.user_name ?? 'Learner',
          content: item.content,
          created_at: item.created_at,
        })));
        setError(null);
      } else {
        setError(res.message ?? 'Unable to load reviews.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load reviews.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitReview = useCallback(
    async (payload: { courseId: string; content: string }) => {
      const res = await postRequest(
        ROUTES.bible.courseComments,
        { course: payload.courseId, content: payload.content },
        { errorMessage: 'Unable to submit review.' },
      );
      if (res?.success) {
        void load();
        return true;
      }
      return false;
    },
    [load],
  );

  return {
    reviews,
    loading,
    error,
    refresh: load,
    submitReview,
  };
}
