export type BroadcastEngagement = {
  reactions: number
  comments: number
  shares: number
  saves: number
}

export type BroadcastItem = {
  id: string
  vertical: 'feeds'
  sourceType: 'feed_post'
  sourceId: string
  creatorId: string
  broadcastedAt: string
  title?: string
  body?: string
  attachments: any[]
  metadata: Record<string, unknown>
  visibility: 'public' | 'community' | 'restricted' | 'private'
  engagement: BroadcastEngagement
}

const normalizeEngagement = (value: any): BroadcastEngagement => ({
  reactions: Number(value?.reactions ?? 0),
  comments: Number(value?.comments ?? 0),
  shares: Number(value?.shares ?? 0),
  saves: Number(value?.saves ?? 0),
})

const extractId = (raw: any): string | null => {
  if (!raw) return null
  if (typeof raw.id === 'string' && raw.id.trim()) return raw.id.trim()
  if (raw._id) return String(raw._id)
  if (raw._doc?.id) return String(raw._doc.id)
  if (raw._doc?._id) return String(raw._doc._id)
  return null
}

export const normalizeBroadcastItem = (raw: any): BroadcastItem | null => {
  const id = extractId(raw)
  if (!id) return null

  const broadcastedAt =
    raw.broadcastedAt ?? raw.createdAt ?? raw.updatedAt ?? new Date().toISOString()

  const visibility = raw.visibility ?? 'public'

  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : typeof raw.metadata?.title === 'string'
      ? raw.metadata.title
      : undefined

  const body =
    typeof raw.body === 'string' && raw.body.trim()
      ? raw.body.trim()
      : typeof raw.text === 'string'
      ? raw.text
      : undefined

  return {
    id,
    vertical: 'feeds',
    sourceType: 'feed_post',
    sourceId: String(raw.sourceId ?? raw.metadata?.feedPostId ?? ''),
    creatorId: String(raw.creatorId ?? raw.metadata?.creatorId ?? ''),
    broadcastedAt,
    title,
    body,
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    metadata: (raw.metadata ?? {}) as Record<string, unknown>,
    visibility: visibility as BroadcastItem['visibility'],
    engagement: normalizeEngagement(raw.engagement),
  }
}
