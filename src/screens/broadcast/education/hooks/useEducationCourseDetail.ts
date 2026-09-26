// src/screens/broadcast/education/hooks/useEducationCourseDetail.ts
//
// Extracted from EducationV2DiscoverPage's inline hydrateDetail/detailItem
// state (Education UX v2) so both the legacy discover page and the new
// CourseDetailScreen/LearningPlayerScreen destinations share one fetch
// path against ROUTES.education.detail instead of two independently
// maintained copies of the same merge logic.
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import type { EducationContentItem } from '@/screens/broadcast/education/api/education.models';

export default function useEducationCourseDetail(initialSeed?: Partial<EducationContentItem> | null) {
  const [item, setItem] = useState<EducationContentItem | null>(
    (initialSeed as EducationContentItem) ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hydrate = useCallback(async (contentId: string, seed?: Partial<EducationContentItem>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getRequest(ROUTES.education.detail(contentId), {
        errorMessage: 'Unable to load education details.',
        forceNetwork: true,
      });
      if (response?.success === false) {
        throw new Error(response?.message || 'Unable to load education details.');
      }
      const payload = response?.data ?? response ?? {};
      const content = payload?.content;
      if (content && typeof content === 'object') {
        setItem(
          prev =>
            ({
              ...((prev || seed || { id: contentId }) as EducationContentItem),
              ...content,
              progress: payload?.progress ?? null,
              insights: payload?.insights ?? null,
              currentItem: payload?.current_item ?? null,
              currentModule: payload?.current_module ?? null,
              nextItem: payload?.next_item ?? null,
              certificate: payload?.certificate ?? null,
              faqs: payload?.faqs ?? [],
              detailSummary:
                payload?.detailSummary ?? payload?.detail_summary ?? content?.detailSummary ?? content?.detail_summary ?? null,
              detail_summary:
                payload?.detail_summary ?? payload?.detailSummary ?? content?.detail_summary ?? content?.detailSummary ?? null,
            } as EducationContentItem),
        );
      }
      return content ?? null;
    } catch (err: any) {
      const message = err?.message || 'Unable to load education details.';
      setError(message);
      Alert.alert('Education', message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const enroll = useCallback(async (contentId: string) => {
    const response = await postRequest(
      ROUTES.education.enroll(contentId),
      {},
      { errorMessage: 'Unable to enroll in this course.' },
    );
    if (response?.success === false) {
      throw new Error(response?.message || 'Unable to enroll in this course.');
    }
    await hydrate(contentId);
    return response;
  }, [hydrate]);

  const requestAccess = useCallback(async (contentId: string) => {
    const response = await postRequest(
      ROUTES.education.contentAccessRequest(contentId),
      {},
      { errorMessage: 'Unable to request access to this course.' },
    );
    if (response?.success === false) {
      throw new Error(response?.message || 'Unable to request access to this course.');
    }
    await hydrate(contentId);
    return response;
  }, [hydrate]);

  const submitItemAction = useCallback(
    async (contentId: string, itemId: string, body: Record<string, any>) => {
      const response = await postRequest(
        ROUTES.education.itemAction(contentId, itemId),
        body,
        { errorMessage: 'Unable to submit.' },
      );
      if (response?.success === false) {
        throw new Error(response?.message || 'Unable to submit.');
      }
      await hydrate(contentId);
      return response;
    },
    [hydrate],
  );

  return { item, loading, error, hydrate, enroll, requestAccess, submitItemAction, setItem };
}
