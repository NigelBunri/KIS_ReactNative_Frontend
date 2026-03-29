import type { HealthInstitutionType } from '@/screens/tabs/profile-screen/types';

export type HealthInstitutionMember = {
  id?: string;
  userId?: string;
  name: string;
  phone?: string;
  email?: string;
  role: string;
  source?: 'owner_added' | 'registered' | 'subscription' | 'imported';
  permissions?: Record<string, boolean>;
};

export type HealthInstitution = {
  id: string;
  name: string;
  type: HealthInstitutionType;
  employees?: HealthInstitutionMember[];
  members?: HealthInstitutionMember[];
};
