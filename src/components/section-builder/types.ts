export type SectionType =
  | 'hero_banner'
  | 'about'
  | 'image_gallery_grid'
  | 'statistics'
  | 'testimonials'
  | 'programs_services'
  | 'call_to_action'
  | 'contact_information'
  | 'faqs'
  | 'social_links'
  | 'hours'
  | 'kis_content';

// Mirrors apps.websites.models.KIS_CONTENT_TARGET_TYPES on the backend —
// keep in sync.
export type KisContentTargetType =
  | 'course'
  | 'product'
  | 'shop_service'
  | 'health_service'
  | 'broadcast_channel'
  | 'post'
  | 'event'
  | 'testimonial';

export type HeroBannerSectionData = {
  sectionBackgroundImageUrl?: string;
  sectionBackgroundColorKey?: string;
  backgroundImageUrl: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
};

export type AboutSectionData = {
  sectionBackgroundImageUrl?: string;
  sectionBackgroundColorKey?: string;
  title: string;
  description: string;
  imageUrl: string;
  layout: 'image_left' | 'image_right';
};

export type ImageGalleryGridSectionData = {
  sectionBackgroundImageUrl?: string;
  sectionBackgroundColorKey?: string;
  title: string;
  images: string[];
  gridStyle: 'two_column' | 'masonry';
};

export type StatisticsSectionData = {
  sectionBackgroundImageUrl?: string;
  sectionBackgroundColorKey?: string;
  title: string;
  metrics: Array<{ id: string; label: string; value: string }>;
};

export type TestimonialsSectionData = {
  sectionBackgroundImageUrl?: string;
  sectionBackgroundColorKey?: string;
  title: string;
  items: Array<{ id: string; quote: string; author: string; role?: string }>;
};

export type ProgramsServicesSectionData = {
  sectionBackgroundImageUrl?: string;
  sectionBackgroundColorKey?: string;
  title: string;
  cards: Array<{ id: string; name: string; description: string }>;
};

export type CallToActionSectionData = {
  sectionBackgroundImageUrl?: string;
  sectionBackgroundColorKey?: string;
  title: string;
  description: string;
  buttonText: string;
  buttonLink: string;
};

export type ContactInformationSectionData = {
  sectionBackgroundImageUrl?: string;
  sectionBackgroundColorKey?: string;
  title: string;
  phone: string;
  email: string;
  address: string;
};

export type FaqsSectionData = {
  sectionBackgroundImageUrl?: string;
  sectionBackgroundColorKey?: string;
  title: string;
  items: Array<{ id: string; question: string; answer: string }>;
};

export type SocialLinksSectionData = {
  sectionBackgroundImageUrl?: string;
  sectionBackgroundColorKey?: string;
  title: string;
  links: Array<{ id: string; platform: string; url: string }>;
};

export type HoursSectionData = {
  sectionBackgroundImageUrl?: string;
  sectionBackgroundColorKey?: string;
  title: string;
  days: Array<{ id: string; day: string; hours: string }>;
};

// Live-linked section — references real KIS records by id (target_ids)
// or an auto filter, resolved server-side on every read. Never stores a
// copy of the underlying course/product/service/etc — see
// apps.websites.kis_content_resolvers on the backend.
export type KisContentSectionData = {
  sectionBackgroundImageUrl?: string;
  sectionBackgroundColorKey?: string;
  heading: string;
  target_type: KisContentTargetType;
  target_ids: string[];
  filter: { category: string | null; featured_only: boolean; ordering: 'recent' | 'popular' | 'alphabetical' | 'manual' };
  presentation: { display_mode: 'grid' | 'carousel' | 'list'; limit: number; columns: number };
  cta_label?: string;
  cta_deep_link?: string;
};

export type SectionDataByType = {
  hero_banner: HeroBannerSectionData;
  about: AboutSectionData;
  image_gallery_grid: ImageGalleryGridSectionData;
  statistics: StatisticsSectionData;
  testimonials: TestimonialsSectionData;
  programs_services: ProgramsServicesSectionData;
  call_to_action: CallToActionSectionData;
  contact_information: ContactInformationSectionData;
  faqs: FaqsSectionData;
  social_links: SocialLinksSectionData;
  hours: HoursSectionData;
  kis_content: KisContentSectionData;
};

export type DynamicLandingSection<T extends SectionType = SectionType> = {
  id: string;
  name: string;
  type: T;
  data: SectionDataByType[T];
};

const createId = () => `section_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const createEmptySectionData = (type: SectionType): SectionDataByType[SectionType] => {
  switch (type) {
    case 'hero_banner':
      return { sectionBackgroundImageUrl: '', sectionBackgroundColorKey: 'ocean_mist', backgroundImageUrl: '', title: '', subtitle: '', ctaText: 'Book Now', ctaLink: '' };
    case 'about':
      return { sectionBackgroundImageUrl: '', sectionBackgroundColorKey: 'mint_soft', title: 'About Us', description: '', imageUrl: '', layout: 'image_left' };
    case 'image_gallery_grid':
      return { sectionBackgroundImageUrl: '', sectionBackgroundColorKey: 'sunset_blush', title: 'Gallery', images: [], gridStyle: 'two_column' };
    case 'statistics':
      return { sectionBackgroundImageUrl: '', sectionBackgroundColorKey: 'lavender_fog', title: 'Key Metrics', metrics: [] };
    case 'testimonials':
      return { sectionBackgroundImageUrl: '', sectionBackgroundColorKey: 'sandstone', title: 'Testimonials', items: [] };
    case 'programs_services':
      return { sectionBackgroundImageUrl: '', sectionBackgroundColorKey: 'slate_air', title: 'Programs & Services', cards: [] };
    case 'call_to_action':
      return { sectionBackgroundImageUrl: '', sectionBackgroundColorKey: 'ocean_mist', title: 'Take the Next Step', description: '', buttonText: 'Contact Us', buttonLink: '' };
    case 'contact_information':
      return { sectionBackgroundImageUrl: '', sectionBackgroundColorKey: 'mint_soft', title: 'Contact', phone: '', email: '', address: '' };
    case 'faqs':
      return { sectionBackgroundImageUrl: '', sectionBackgroundColorKey: 'sandstone', title: 'Frequently Asked Questions', items: [] };
    case 'social_links':
      return { sectionBackgroundImageUrl: '', sectionBackgroundColorKey: 'slate_air', title: 'Follow Us', links: [] };
    case 'hours':
      return { sectionBackgroundImageUrl: '', sectionBackgroundColorKey: 'mint_soft', title: 'Hours', days: [] };
    case 'kis_content':
      return {
        sectionBackgroundImageUrl: '',
        sectionBackgroundColorKey: 'ocean_mist',
        heading: '',
        target_type: 'product',
        target_ids: [],
        filter: { category: null, featured_only: false, ordering: 'recent' },
        presentation: { display_mode: 'grid', limit: 6, columns: 3 },
        cta_label: '',
        cta_deep_link: '',
      };
    default:
      return { sectionBackgroundImageUrl: '', sectionBackgroundColorKey: 'mint_soft', title: 'About Us', description: '', imageUrl: '', layout: 'image_left' };
  }
};

export const createSection = (type: SectionType): DynamicLandingSection => ({
  id: createId(),
  name: `${type.replace(/_/g, ' ')}`,
  type,
  data: createEmptySectionData(type),
});
