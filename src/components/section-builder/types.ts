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
  | 'form'
  | 'embed'
  | 'kis_video'
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

// Matches apps.websites.models.FORM_FIELD_TYPES on the backend — keep in
// sync. Submissions are validated server-side against this same `fields`
// schema (apps.websites.forms.validate_submission_data) — any key not
// declared here is dropped, never stored.
export type FormFieldType = 'text' | 'email' | 'textarea';

export type FormSectionData = {
  sectionBackgroundImageUrl?: string;
  sectionBackgroundColorKey?: string;
  title: string;
  submitLabel: string;
  fields: Array<{ id: string; key: string; label: string; type: FormFieldType; required: boolean }>;
};

// Matches apps.websites.models.EMBED_PROVIDERS on the backend — keep in
// sync. An allowlist, not an arbitrary-URL embed — see that constant's
// docstring for why (a stored-XSS-adjacent vector otherwise).
export type EmbedProvider = 'youtube' | 'vimeo' | 'calendly' | 'google_maps' | 'google_calendar' | 'spotify' | 'loom';

export type EmbedSectionData = {
  sectionBackgroundImageUrl?: string;
  sectionBackgroundColorKey?: string;
  title: string;
  provider: EmbedProvider;
  url: string;
};

// Matches apps.websites.kis_video.KIS_VIDEO_SOURCES on the backend — a
// single specific KIS video (not a grid), resolved server-side, never a
// third-party embed. Only Broadcast Channel and Health Institution
// owners have real video content to pick from as of writing this — see
// that module's docstring for why Education/Marketplace aren't here.
export type KisVideoSource = 'broadcast_content' | 'health_engine_item';

export type KisVideoSectionData = {
  sectionBackgroundImageUrl?: string;
  sectionBackgroundColorKey?: string;
  title: string;
  source: KisVideoSource | '';
  target_id: string;
  /** Cosmetic — this editor's own live preview only. The public page
   * always re-resolves from source+target_id server-side. */
  video_url?: string;
  thumbnail_url?: string;
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
  form: FormSectionData;
  embed: EmbedSectionData;
  kis_video: KisVideoSectionData;
  kis_content: KisContentSectionData;
};

export type DynamicLandingSection<T extends SectionType = SectionType> = {
  id: string;
  name: string;
  type: T;
  data: SectionDataByType[T];
  responsive?: { hidden_on?: Array<'mobile' | 'desktop'> };
  /** Which alternate visual design to render for this section — see
   * sectionVariants.ts. Absent means "classic" (the original design).
   * Only section types listed in SECTION_VARIANTS support this. */
  variant?: string;
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
    case 'form':
      return {
        sectionBackgroundImageUrl: '',
        sectionBackgroundColorKey: 'ocean_mist',
        title: 'Contact Us',
        submitLabel: 'Submit',
        fields: [
          { id: 'field_name', key: 'name', label: 'Name', type: 'text', required: true },
          { id: 'field_email', key: 'email', label: 'Email', type: 'email', required: true },
          { id: 'field_message', key: 'message', label: 'Message', type: 'textarea', required: false },
        ],
      };
    case 'embed':
      return { sectionBackgroundImageUrl: '', sectionBackgroundColorKey: 'slate_air', title: '', provider: 'youtube', url: '' };
    case 'kis_video':
      return { sectionBackgroundImageUrl: '', sectionBackgroundColorKey: 'slate_air', title: '', source: '', target_id: '' };
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
