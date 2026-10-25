// src/screens/broadcast/workspace/workspaceTheme.ts
//
// Shared forced palette for the whole Broadcast Workspace / Channel Studio
// area: dark, near-black background; warm white primary text; muted gray
// secondary text; restrained emerald/mint accents - a deliberate, consistent
// "creator platform" identity independent of whatever accent the user has
// picked for the rest of the app, the same way LiveWatchPage's player area
// already commits to a fixed brand palette rather than the user's own theme
// choice. "emerald" is a real, already-shipped accent id (theme/constants.ts
// KIS_ACCENT_THEMES) - not a new color invented for this redesign; forcing
// it here (rather than letting the user's own accentId apply) is what gives
// this feature area its own identity.
import { createPalette } from '@/theme/constants';

export const WORKSPACE_PALETTE = createPalette('dark', 'emerald');
export const WORKSPACE_TONE = 'dark' as const;
