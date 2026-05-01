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

export const privacyFieldOrder = [
  'avatar',
  'cover',
  'headline',
  'bio',
  'industry',
  'contact_phone',
  'contact_email',
  'experience',
  'education',
  'projects',
  'skills',
  'recommendations',
  'articles',
  'activity',
  'services',
  'highlights',
  'portfolio',
  'case_study',
  'testimonial',
  'certification',
  'intro_video',
] as const;

export const fieldPrivacyDescriptions: Record<string, string> = {
  avatar: 'Your main public identity image.',
  cover: 'The banner image shown behind your profile.',
  headline: 'Your short professional summary.',
  bio: 'Your longer introduction and personal summary.',
  industry: 'The field or domain you work in.',
  contact_phone: 'The phone number people can use to reach you.',
  contact_email: 'The email address visible on your profile.',
  experience: 'Work experience and role history.',
  education: 'Education history and qualifications.',
  projects: 'Public project and portfolio work.',
  skills: 'Skill tags and verified strengths.',
  recommendations: 'Recommendations written about you.',
  articles: 'Published articles from your profile.',
  activity: 'Recent public actions and profile activity.',
  services: 'Services you offer from your profile.',
  highlights: 'Pinned highlights and standout moments.',
  portfolio: 'Portfolio showcase items.',
  case_study: 'Detailed case study showcase items.',
  testimonial: 'Testimonials and social proof.',
  certification: 'Certificates and credentials.',
  intro_video: 'Your intro or presentation video.',
};

export const privacyFieldGroups = [
  {
    key: 'identity',
    title: 'Identity',
    description: 'Your core public identity and first impression.',
    fields: ['avatar', 'cover', 'headline', 'bio', 'industry'],
  },
  {
    key: 'contact',
    title: 'Contact',
    description: 'How people can directly reach you.',
    fields: ['contact_phone', 'contact_email'],
  },
  {
    key: 'profile_content',
    title: 'Profile content',
    description: 'The professional information shown on your main profile.',
    fields: ['experience', 'education', 'projects', 'skills', 'recommendations', 'articles', 'activity', 'services', 'highlights'],
  },
  {
    key: 'showcase',
    title: 'Showcase',
    description: 'Portfolio and proof items attached to your profile.',
    fields: ['portfolio', 'case_study', 'testimonial', 'certification', 'intro_video'],
  },
] as const;

export const visibilityOptions = [
  { value: 'public', label: 'Public' },
  { value: 'contacts', label: 'Contacts only (mutual)' },
  { value: 'custom', label: 'Custom list' },
  { value: 'private', label: 'Only me' },
];

export const visibilityDescriptions: Record<string, string> = {
  public: 'Everyone can see this part of your profile.',
  contacts: 'Only mutual contacts can see this part.',
  custom: 'Only the people you add below can see this part.',
  private: 'Only you can see this part.',
};

export const walletModes = [
  { value: 'add_kisc', label: 'Add KIS Coins' },
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
