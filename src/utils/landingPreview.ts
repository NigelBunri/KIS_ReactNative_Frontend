import { resolveBackendAssetUrl } from '@/network';
import { resolveShopImageUri } from '@/utils/shopAssets';

export const resolveEntityImageUri = (...values: Array<string | null | undefined>) => {
  for (const raw of values) {
    if (!raw) continue;
    const trimmed = String(raw).trim();
    if (!trimmed) continue;
    return resolveBackendAssetUrl(trimmed) ?? trimmed;
  }
  return '';
};

export const buildShopLandingPreview = (shop: any) => {
  const landingPage = shop?.landing_page ?? shop?.landingPage ?? {};
  const galleryFromSections = Array.isArray(landingPage?.sections)
    ? landingPage.sections.find((section: any) => section?.type === 'image_gallery_grid')?.data?.images
    : undefined;
  const previewGalleryImageUris = Array.isArray(landingPage?.gallery)
    ? landingPage.gallery
    : Array.isArray(galleryFromSections)
    ? galleryFromSections
    : undefined;
  const heroImage = resolveEntityImageUri(
    landingPage?.hero?.imageUrl,
    landingPage?.hero?.image_url,
    landingPage?.hero?.image,
    landingPage?.hero_image_url,
    landingPage?.hero_image,
    shop?.image_url,
    shop?.featured_image,
    shop?.branding?.logo_url,
  );
  const ctaLabel =
    landingPage?.hero?.ctaLabel ??
    landingPage?.hero?.ctaText ??
    landingPage?.hero?.cta_label ??
    landingPage?.hero_cta_text ??
    landingPage?.hero_cta_label ??
    'View shop';
  const ctaUrl =
    landingPage?.hero?.ctaUrl ??
    landingPage?.hero?.ctaLink ??
    landingPage?.hero?.cta_url ??
    landingPage?.hero_cta_url ??
    landingPage?.hero_cta_link ??
    '';
  return {
    landingDraft: {
      ...landingPage,
      hero: {
        ...(landingPage?.hero ?? {}),
        title: landingPage?.hero?.title ?? landingPage?.headline ?? shop?.name ?? 'Shop',
        slogan:
          landingPage?.hero?.slogan ??
          landingPage?.hero?.subtitle ??
          landingPage?.subheadline ??
          shop?.description ??
          '',
        subtitle:
          landingPage?.hero?.subtitle ??
          landingPage?.hero?.slogan ??
          landingPage?.subheadline ??
          shop?.description ??
          '',
        imageUrl: heroImage,
        ctaLabel,
        ctaText: ctaLabel,
        ctaUrl,
        ctaLink: ctaUrl,
      },
      sections: Array.isArray(landingPage?.sections) ? landingPage.sections : [],
      gallery: previewGalleryImageUris ?? landingPage?.gallery ?? [],
      landingBackgroundImageUrl: landingPage?.landingBackgroundImageUrl ?? '',
      landingBackgroundColorKey: landingPage?.landingBackgroundColorKey ?? '',
      landingLogoUrl: landingPage?.landingLogoUrl ?? resolveShopImageUri(shop),
    },
    heroImage,
    previewGalleryImageUris,
  };
};
