// AND-476: Experience, Education, and Project all require start_date
// server-side (apps/accounts/models.py's Experience/Education/Project
// models each declare `start_date = models.DateField()`, no null/blank) -
// but EditItemModal.tsx had no field to enter one at all, so saving any of
// these three item types always failed. Pins the client-side validation
// that now catches this before the network call, and confirms every other
// item type (which has no such server-side requirement) is left alone.

import { itemRequiresStartDate } from '../src/screens/tabs/profile/useProfileController';

describe('itemRequiresStartDate', () => {
  it.each(['experience', 'education', 'project'] as const)(
    'requires a start_date for %s when missing',
    (type) => {
      expect(itemRequiresStartDate(type, {})).toBe(true);
      expect(itemRequiresStartDate(type, { start_date: '' })).toBe(true);
      expect(itemRequiresStartDate(type, { start_date: '   ' })).toBe(true);
    },
  );

  it.each(['experience', 'education', 'project'] as const)(
    'is satisfied once start_date is present for %s',
    (type) => {
      expect(itemRequiresStartDate(type, { start_date: '2024-01-15' })).toBe(false);
    },
  );

  it.each([
    'skill', 'article', 'portfolio', 'case_study', 'testimonial',
    'certification', 'intro_video', 'highlight', 'service', 'availability',
    'language', 'location', 'compensation', 'ask_tag', 'social_proof',
    'skill_badge',
  ] as const)('never requires a start_date for %s', (type) => {
    expect(itemRequiresStartDate(type, {})).toBe(false);
  });
});
