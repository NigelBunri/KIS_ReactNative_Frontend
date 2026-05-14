import ROUTES from '@/network';

export type ChannelEmbedSnippetOptions = {
  contentId: string;
  token?: string | null;
  width?: number;
  height?: number;
  baseUrl?: string;
};

const DEFAULT_WIDTH = 560;
const DEFAULT_HEIGHT = 315;

export const buildChannelEmbedUrl = ({
  contentId,
  token,
  baseUrl,
}: ChannelEmbedSnippetOptions): string => {
  const route = ROUTES?.broadcasts?.embedContent
    ? ROUTES.broadcasts.embedContent(contentId)
    : '';
  const src = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/embed/content/${contentId}`
    : route;
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${src}${query}`;
};

export const buildChannelEmbedHtml = (options: ChannelEmbedSnippetOptions): string => {
  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;
  const src = buildChannelEmbedUrl(options);
  return `<iframe src="${src}" width="${width}" height="${height}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
};
