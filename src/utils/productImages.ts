import { resolveBackendAssetUrl } from '@/network';

type ProductImageEntry = {
  image_url?: string | null;
  image_file?: string | null;
  uri?: string | null;
  url?: string | null;
  thumbnail?: string | null;
  cover_url?: string | null;
  cover_image?: string | null;
};

const FALLBACK_KEYS: Array<keyof ProductImageEntry> = [
  'image_url',
  'image_file',
  'uri',
  'url',
  'thumbnail',
  'cover_url',
  'cover_image',
];

export const resolveProductImageUri = (value?: string | null): string => {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return resolveBackendAssetUrl(trimmed) ?? trimmed;
};

const extractCandidateFromEntry = (entry?: ProductImageEntry | string | null): string => {
  if (!entry) return '';
  if (typeof entry === 'string') {
    return entry;
  }
  for (const key of FALLBACK_KEYS) {
    const candidate = entry[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return '';
};

const collectFromArray = (source?: unknown): string[] => {
  if (!Array.isArray(source)) return [];
  return source.map(extractCandidateFromEntry).filter(Boolean);
};

export const collectProductImageUris = (product?: any): string[] => {
  if (!product) return [];

  const seen = new Set<string>();
  const addUri = (value?: string | null) => {
    const resolved = resolveProductImageUri(value);
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
    }
  };

  const addFromObject = (entry?: ProductImageEntry | null) => {
    const candidate = extractCandidateFromEntry(entry);
    if (candidate) {
      addUri(candidate);
    }
  };

  addUri(
    product.image_url ??
      product.image_file ??
      product.featured_image ??
      product.main_image_url ??
      product.mainImageUrl ??
      product.cover_url ??
      product.cover_image ??
      (typeof product.image === 'string' ? product.image : ''),
  );

  if (product?.main_image) {
    if (typeof product.main_image === 'string') {
      addUri(product.main_image);
    } else {
      addFromObject(product.main_image);
    }
  }

  const gallerySources = [
    product?.gallery_images,
    product?.images,
    product?.image_gallery,
    product?.galleryImages,
  ];

  for (const source of gallerySources) {
    for (const uri of collectFromArray(source)) {
      addUri(uri);
    }
  }

  return Array.from(seen);
};
