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
  const heroImage = resolveEntityImageUri(
    landingPage?.hero_image_url,
    landingPage?.hero_image,
    landingPage?.hero?.imageUrl,
    landingPage?.hero?.image,
    shop?.image_url,
    shop?.featured_image,
    shop?.branding?.logo_url,
  );
  return {
    landingDraft: {
      ...landingPage,
      hero: {
        title: landingPage?.headline ?? shop?.name ?? 'Shop',
        slogan: landingPage?.subheadline ?? shop?.description ?? '',
        imageUrl: heroImage,
        ctaText: landingPage?.hero_cta_text ?? landingPage?.hero_cta_label ?? 'View shop',
        ctaLink: landingPage?.hero_cta_url ?? landingPage?.hero_cta_link ?? '',
      },
      sections: Array.isArray(landingPage?.sections) ? landingPage.sections : [],
      landingBackgroundImageUrl: '',
      landingLogoUrl: resolveShopImageUri(shop),
    },
    heroImage,
    previewGalleryImageUris: Array.isArray(landingPage?.gallery) ? landingPage.gallery : undefined,
  };
};
