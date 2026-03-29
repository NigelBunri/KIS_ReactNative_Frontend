import { resolveBackendAssetUrl } from '@/network';

const pickFirstString = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) return normalized;
    }
  }
  return '';
};

const buildImageUri = (...values: Array<string | null | undefined>) => {
  const candidate = pickFirstString(...values);
  if (!candidate) return '';
  return resolveBackendAssetUrl(candidate) ?? candidate;
};

export const resolveShopImageUri = (detail?: any, source?: any) =>
  buildImageUri(
    detail?.featuredImage,
    detail?.featuredImageUrl,
    detail?.featured_image,
    detail?.featured_image_url,
    detail?.image_url,
    detail?.imageUrl,
    detail?.image,
    detail?.cover_url,
    detail?.coverUrl,
    detail?.image_file?.url,
    detail?.branding?.logo_url,
    detail?.branding?.logoUrl,
    detail?.hero_image_url,
    detail?.hero_image,
    detail?.hero?.image_url,
    detail?.hero?.image,
    detail?.hero?.image?.url,
    detail?.hero?.imageUrl,
    detail?.landing_page?.hero?.image_url,
    detail?.landing_page?.hero?.image,
    detail?.landing_page?.hero?.image?.url,
    detail?.landing_page?.hero?.imageUrl,
    detail?.landing_page?.hero_image_url,
    detail?.landing_page?.hero_image,
    source?.featured_image,
    source?.featured_image_url,
    source?.featuredImage,
    source?.featuredImageUrl,
    source?.hero_image_url,
    source?.hero_image,
    source?.hero?.image_url,
    source?.hero?.image,
    source?.hero?.image?.url,
    source?.hero?.imageUrl,
    source?.landing_page?.hero?.image_url,
    source?.landing_page?.hero?.image,
    source?.landing_page?.hero?.image?.url,
    source?.landing_page?.hero?.imageUrl,
    source?.image_url,
    source?.image,
    source?.logo_url,
    source?.logo,
  );

export const resolveShopDescription = (detail?: any, source?: any) =>
  pickFirstString(
    detail?.description,
    source?.description,
    detail?.tagline,
    source?.tagline,
    detail?.landing_page?.subheadline,
    source?.landing_page?.subheadline,
    detail?.landing_page?.headline,
    source?.landing_page?.headline,
  );
