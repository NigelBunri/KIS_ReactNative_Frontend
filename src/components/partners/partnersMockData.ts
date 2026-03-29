// src/screens/tabs/partnersMockData.ts
import { Partner, PartnerCommunity, PartnerGroup } from './partnersTypes';

export const MOCK_PARTNERS: Partner[] = [
  {
    id: '1',
    name: 'Kingdom Builders Intl',
    slug: 'kingdom-builders-intl',
    description: 'Building kingdom-minded businesses.',
    avatar_url: '',
    initials: 'KB',
    tagline: 'Building kingdom-minded businesses.',
    admins: [
      { id: 'a1', name: 'Sarah Johnson', initials: 'SJ', position: 'Founder / CEO' },
      { id: 'a2', name: 'David Kim', initials: 'DK', position: 'COO' },
      { id: 'a3', name: 'Mary O.', initials: 'MO', position: 'Community Lead' },
    ],
  },
  {
    id: '2',
    name: 'Youth Impact Network',
    slug: 'youth-impact-network',
    description: 'Equipping the next generation.',
    avatar_url: '',
    initials: 'YI',
    tagline: 'Equipping the next generation.',
    admins: [
      { id: 'a4', name: 'John Doe', initials: 'JD', position: 'Director' },
      { id: 'a5', name: 'Rachel M.', initials: 'RM', position: 'Programs Lead' },
    ],
  },
  {
    id: '3',
    name: 'Hope Health Foundation',
    slug: 'hope-health-foundation',
    description: 'Health with a kingdom lens.',
    avatar_url: '',
    initials: 'HH',
    tagline: 'Health with a kingdom lens.',
    admins: [
      { id: 'a6', name: 'Dr. Faith', initials: 'DF', position: 'Medical Director' },
      { id: 'a7', name: 'James L.', initials: 'JL', position: 'Operations' },
    ],
  },
];

export const MOCK_COMMUNITIES: PartnerCommunity[] = [
  {
    id: 'c1',
    partner: '1',
    name: 'Founders Circle',
    description: 'Leaders & founders collaboration space.',
  },
  {
    id: 'c2',
    partner: '1',
    name: 'Marketplace Ministries',
    description: 'Business & marketplace focused groups.',
  },
  {
    id: 'c3',
    partner: '2',
    name: 'Youth Leaders Hub',
    description: 'Youth pastors & coordinators.',
  },
];

export const MOCK_GROUPS: PartnerGroup[] = [
  // Partner 1 – standalone groups
  { id: 'g1', partner: '1', name: '# general' },
  { id: 'g2', partner: '1', name: '# announcements' },
  // Partner 1 – in communities
  { id: 'g3', partner: '1', name: '# founders-chat', community: 'c1' },
  { id: 'g4', partner: '1', name: '# marketplace-roundtable', community: 'c2' },
  { id: 'g5', partner: '1', name: '# marketplace-mentors', community: 'c2' },

  // Partner 2
  { id: 'g6', partner: '2', name: '# announcements' },
  { id: 'g7', partner: '2', name: '# mentorship-hub' },
  { id: 'g8', partner: '2', name: '# youth-pastors', community: 'c3' },

  // Partner 3
  { id: 'g9', partner: '3', name: '# community-updates' },
];
