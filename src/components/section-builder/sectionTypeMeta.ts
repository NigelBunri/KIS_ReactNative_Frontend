import type { SectionType } from './types';

export type SectionTypeMeta = {
  type: SectionType;
  title: string;
  description: string;
};

export const SECTION_TYPE_META: SectionTypeMeta[] = [
  {
    type: 'hero_banner',
    title: 'Hero Banner Section',
    description: 'Large visual header with headline, supporting text, and CTA.',
  },
  {
    type: 'about',
    title: 'About Section',
    description: 'Image + text story block with configurable alignment.',
  },
  {
    type: 'image_gallery_grid',
    title: 'Image Gallery Grid',
    description: 'Multi-image gallery with selectable layout styles.',
  },
  {
    type: 'statistics',
    title: 'Statistics / Metrics Section',
    description: 'Highlight impact metrics with compact stat cards.',
  },
  {
    type: 'testimonials',
    title: 'Testimonials Section',
    description: 'Social proof area for patient/client testimonials.',
  },
  {
    type: 'programs_services',
    title: 'Programs / Services Cards Section',
    description: 'Card-based list of offerings and treatment programs.',
  },
  {
    type: 'call_to_action',
    title: 'Call To Action Section',
    description: 'Focused conversion block with one primary action.',
  },
  {
    type: 'contact_information',
    title: 'Contact Information Section',
    description: 'Structured contact details for easy reach-out.',
  },
  {
    type: 'faqs',
    title: 'FAQs Section',
    description: 'Expandable list of frequently asked questions.',
  },
  {
    type: 'social_links',
    title: 'Social Links Section',
    description: 'Row of links to your social profiles.',
  },
  {
    type: 'hours',
    title: 'Hours Section',
    description: 'Operating hours by day of the week.',
  },
  {
    type: 'form',
    title: 'Contact Form',
    description: 'Collect name/email/message-style responses from visitors, with spam filtering and email alerts.',
  },
  {
    type: 'kis_content',
    title: 'Add KIS Content',
    description: 'Show live courses, products, services, posts, or other KIS content — always up to date automatically.',
  },
];
