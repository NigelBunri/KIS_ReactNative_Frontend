// Alternate visual designs per section type — mirrors the website repo's
// components/website-builder/SectionRenderer.tsx SECTION_VARIANTS and the
// backend's apps.websites.models.SECTION_VARIANTS exactly. Index 0 is
// always "classic", the original single design each type had before
// variants existed, so a section with no `variant` field (every section
// created before this feature) keeps rendering unchanged everywhere.
//
// `preview` is a small structural description the design-picker modal
// (SectionDesignPickerModal.tsx) uses to draw a distinguishing mockup —
// it does not need to be pixel-identical to the live CSS, just visually
// distinct enough that a user can tell the seven apart at a glance.
export type SectionVariantPreviewShape =
  | 'hero_overlay'
  | 'split_image_text'
  | 'split_text_image'
  | 'bottom_card'
  | 'minimal_strip'
  | 'centered_stack'
  | 'card_overlap'
  | 'bordered_quote'
  | 'full_banner';

export type SectionVariantOption = {
  key: string;
  label: string;
  description: string;
  preview: SectionVariantPreviewShape;
};

export const SECTION_VARIANTS: Partial<Record<string, SectionVariantOption[]>> = {
  hero_banner: [
    { key: 'classic', label: 'Classic Overlay', description: 'Full-width background image with centered text on top.', preview: 'hero_overlay' },
    { key: 'split_left', label: 'Split — Image Left', description: 'Image on the left, headline and button on the right.', preview: 'split_image_text' },
    { key: 'split_right', label: 'Split — Image Right', description: 'Headline and button on the left, image on the right.', preview: 'split_text_image' },
    { key: 'bottom_card', label: 'Bottom Card', description: 'Full-bleed image with a floating text card anchored at the bottom.', preview: 'bottom_card' },
    { key: 'minimal_banner', label: 'Minimal Strip', description: 'A slim image strip above centered, editorial-style text.', preview: 'minimal_strip' },
  ],
  about: [
    { key: 'classic', label: 'Classic Side-by-Side', description: 'Image and text next to each other.', preview: 'split_image_text' },
    { key: 'centered_stack', label: 'Centered Stack', description: 'A round image centered above centered text.', preview: 'centered_stack' },
    { key: 'card_overlap', label: 'Overlapping Card', description: 'A large image with a text card overlapping its bottom edge.', preview: 'card_overlap' },
    { key: 'bordered_quote', label: 'Bordered Quote', description: 'Text in a gold-accented column beside a square image.', preview: 'bordered_quote' },
    { key: 'full_width_banner', label: 'Full-Width Banner', description: 'A full-width image with a text panel overlapping its base.', preview: 'full_banner' },
  ],
};

export function getSectionVariants(type: string): SectionVariantOption[] | undefined {
  return SECTION_VARIANTS[type];
}

export function resolveSectionVariant(type: string, variant: string | undefined): SectionVariantOption {
  const options = SECTION_VARIANTS[type];
  const fallback: SectionVariantOption = { key: 'classic', label: 'Classic', description: '', preview: 'hero_overlay' };
  if (!options || !options.length) return fallback;
  return options.find((o) => o.key === variant) ?? options[0];
}
