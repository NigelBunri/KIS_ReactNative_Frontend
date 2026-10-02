// src/screens/education/shared/courseGroupChat.ts
//
// One persistent group chat per course, shared by everyone enrolled — the
// live-class equivalent of "the course has a classroom". Reuses the app's
// existing generic chat-groups infrastructure (the same one Communities/
// Partners already use — see src/Module/AddContacts/components/
// NewGroupForm.tsx and src/screens/tabs/CommunitiesTab.tsx for the proven
// create -> attach-conversation -> open pattern this mirrors) instead of
// inventing anything education-specific on the backend:
//   - POST  ROUTES.groups.create              — the group itself
//   - PATCH ROUTES.groups.detail(id)          — { create_conversation: true }
//   - POST  ROUTES.groups.join(id)            — student self-joins
// No backend changes, no new routes.
//
// Persistence without a backend field: courses have no `group_id` column to
// store this on, so the group is found again (instead of duplicated) by a
// deterministic slug derived from the course id — any device resolves to
// the exact same group by looking up that same slug, which is why this
// doesn't need any client-side caching to work across users/devices.
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';

export type CourseGroupChat = {
  groupId: string;
  conversationId: string;
  name: string;
};

const unwrapList = (response: any): any[] => {
  if (Array.isArray(response?.data?.results)) return response.data.results;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
};

const courseGroupSlug = (courseId: string) => `edu-course-${courseId}`;

async function findCourseGroup(courseId: string): Promise<any | null> {
  const slug = courseGroupSlug(courseId);
  const response = await getRequest(ROUTES.groups.list, { params: { slug } });
  const rows = unwrapList(response);
  return rows.find((g: any) => g?.slug === slug) ?? rows[0] ?? null;
}

/**
 * Finds this course's group chat, creating it (and its underlying
 * conversation) the first time anyone needs it. Safe to call repeatedly —
 * every caller converges on the same group via the deterministic slug.
 */
export async function getOrCreateCourseGroupChat(
  courseId: string,
  courseTitle: string,
): Promise<CourseGroupChat | null> {
  let group = await findCourseGroup(courseId);

  if (!group) {
    const slug = courseGroupSlug(courseId);
    const createRes = await postRequest(
      ROUTES.groups.create,
      {
        name: `${courseTitle} — Class Chat`.slice(0, 120),
        slug,
        description: 'Course discussion and live class chat/call.',
      },
      { errorMessage: 'Unable to create the course group chat.' },
    );
    if (createRes?.success) {
      group = createRes.data;
    } else {
      // Someone else (a concurrent request, or the instructor on another
      // device) may have created it in the meantime — look it up once more
      // before treating this as a real failure.
      group = await findCourseGroup(courseId);
    }
  }

  if (!group?.id) return null;

  let conversationId: string | null = group.conversation_id ?? null;
  if (!conversationId) {
    const attachRes = await patchRequest(
      ROUTES.groups.detail(group.id),
      { create_conversation: true },
      { errorMessage: 'Unable to set up the group chat.' },
    );
    const updated = attachRes?.data ?? attachRes;
    conversationId = updated?.conversation_id ?? null;
  }

  if (!conversationId) return null;

  return {
    groupId: String(group.id),
    conversationId: String(conversationId),
    name: group.name ?? courseTitle,
  };
}

/** Best-effort self-join — a student who's already a member (or for whom
 * this silently no-ops server-side) isn't treated as a failure. */
export async function joinCourseGroupChat(groupId: string): Promise<void> {
  try {
    await postRequest(ROUTES.groups.join(groupId), {});
  } catch {
    // Non-fatal — worst case they can still open the chat/call if the group
    // is otherwise accessible to them.
  }
}
