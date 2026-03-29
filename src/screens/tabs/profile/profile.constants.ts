// src/screens/tabs/profile/profile.constants.ts
export const fieldLabels: Record<string, string> = {
  avatar: 'Profile photo',
  cover: 'Cover photo',
  headline: 'Headline',
  bio: 'Bio',
  industry: 'Industry',
  contact_phone: 'Phone',
  contact_email: 'Email',
  experience: 'Experience',
  education: 'Education',
  projects: 'Projects',
  skills: 'Skills',
  recommendations: 'Recommendations',
  articles: 'Articles',
  activity: 'Activity',
  services: 'Services',
  highlights: 'Highlights',
  portfolio: 'Portfolio',
  case_study: 'Case studies',
  testimonial: 'Testimonials',
  certification: 'Certifications',
  intro_video: 'Intro video',
};

export const visibilityOptions = [
  { value: 'public', label: 'Public' },
  { value: 'contacts', label: 'Contacts only (mutual)' },
  { value: 'custom', label: 'Custom list' },
  { value: 'private', label: 'Only me' },
];

export const walletModes = [
  { value: 'add_kisc', label: 'Add KIS Coins' },
  { value: 'spend_kisc', label: 'Use KIS Coins' },
  { value: 'transfer', label: 'Send KIS Coins' },
];

export const paymentProviders = [
  { value: 'flutterwave', label: 'Flutterwave' },
  { value: 'mobilemoney_mtn', label: 'MTN MoMo' },
  { value: 'mobilemoney_orange', label: 'Orange Money' },
];

export const popularLanguages = [
  'English',
  'Mandarin Chinese',
  'Hindi',
  'Spanish',
  'French',
  'German',
];
