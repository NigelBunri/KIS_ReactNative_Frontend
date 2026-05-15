import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';

export type KISAgeMode = 'child' | 'youth' | 'adult' | 'older_adult';
export type KISNavigationMode = 'standard' | 'simplified' | 'guided';
export type KISFontScaleMode = 'standard' | 'large' | 'extra_large';

export type FamilyAccessibilityPreferences = {
  age_mode: KISAgeMode;
  navigation_mode: KISNavigationMode;
  font_scale: KISFontScaleMode;
  motion: 'system' | 'reduced';
  contrast: 'standard' | 'high';
  family_safe_content: boolean;
  safe_recommendations: boolean;
  hide_sensitive_commerce: boolean;
  hide_public_comments_for_child: boolean;
  guardian_review_required: boolean;
  bible_family_journeys: boolean;
  learning_family_mode: boolean;
  large_tap_targets: boolean;
  simplified_labels: boolean;
};

export type FamilyAccessibilityPayload = {
  preferences: FamilyAccessibilityPreferences;
  accessibility: {
    min_touch_target: number;
    font_scale_multiplier: number;
    reduced_motion: boolean;
    high_contrast: boolean;
    simplified_navigation: boolean;
  };
  family_safety: {
    christian_principles_visible: boolean;
    pornography_blocked_everywhere: boolean;
    media_safety_gate_required: boolean;
    safe_recommendations: boolean;
    child_youth_defaults: boolean;
    guardian_review_required: boolean;
  };
  journeys: {
    bible_family_journeys: boolean;
    learning_family_mode: boolean;
    recommended_bible_entry: string;
    recommended_learning_entry: string;
  };
};

export const fetchFamilyAccessibilityPreferences = async (): Promise<FamilyAccessibilityPayload | null> => {
  const response = await getRequest(ROUTES.profilePreferences.familyAccessibility, {
    forceNetwork: true,
    errorMessage: 'Unable to load family accessibility preferences.',
  });
  if (!response.success) throw new Error(response.message || 'Unable to load family accessibility preferences.');
  return response.data || null;
};

export const saveFamilyAccessibilityPreferences = async (
  preferences: Partial<FamilyAccessibilityPreferences>,
): Promise<FamilyAccessibilityPayload | null> => {
  const response = await patchRequest(
    ROUTES.profilePreferences.familyAccessibility,
    { preferences },
    { errorMessage: 'Unable to save family accessibility preferences.' },
  );
  if (!response.success) throw new Error(response.message || 'Unable to save family accessibility preferences.');
  return response.data || null;
};
