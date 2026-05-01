const cleanId = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  return text || null;
};

export const resolveBroadcastPosterUserId = (item: any): string | null => {
  const author =
    item?.author && typeof item.author === 'object' ? item.author : null;
  const user = item?.user && typeof item.user === 'object' ? item.user : null;
  const broadcastedBy =
    item?.broadcasted_by && typeof item.broadcasted_by === 'object'
      ? item.broadcasted_by
      : null;

  return (
    cleanId(author?.id) ??
    cleanId(author?.user_id) ??
    cleanId(author?.userId) ??
    cleanId(item?.broadcasted_by_id) ??
    cleanId(item?.broadcastedById) ??
    cleanId(item?.broadcasted_by) ??
    cleanId(item?.broadcastedBy) ??
    cleanId(broadcastedBy?.id) ??
    cleanId(broadcastedBy?.user_id) ??
    cleanId(user?.id) ??
    cleanId(item?.user_id) ??
    cleanId(item?.userId) ??
    cleanId(item?.creator_id) ??
    cleanId(item?.creatorId) ??
    null
  );
};
