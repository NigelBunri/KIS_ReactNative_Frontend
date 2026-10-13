import { usePartnerSlidePanel } from './hooks/usePartnerSlidePanel';

/**
 * Pure slide-panel open/close/animate boilerplate — consolidated into
 * `usePartnerSlidePanel` as part of the P2-1 refactor. Exported name,
 * signature, and return shape are unchanged for existing consumers.
 */
export const usePartnerActivityPanel = (width: number) => usePartnerSlidePanel(width);
