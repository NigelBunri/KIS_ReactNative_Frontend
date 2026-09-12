// src/screens/tabs/bible/games/gameScreenTypes.ts
//
// GameScreenProps lives here rather than on BibleGamesPanel.tsx itself so
// all 30 game screens can import the type without a circular reference -
// BibleGamesPanel.tsx React.lazy-imports every game screen, so a game
// screen importing a type back from the panel would create exactly the
// hub -> game -> panel -> game import cycle gameMetadata.ts's docblock
// already calls out avoiding for the same reason (hub -> game -> stats ->
// hub). Same fix, same shape of problem.

import type { GameKey } from './gameStorage';

export type GameScreenProps = {
  gameKey: GameKey;
  /** Which of the 10 stages to play - always the exact stage the player
   * tapped on the journey map, never assumed to be "whatever's current." */
  stageIndex: number;
  /** True when stageIndex is an already-completed stage being replayed to
   * improve its score. Screens must pass this straight through to
   * gameStorage.ts's finishStage - never call completeCurrentStage
   * directly - so a replay can never re-advance progress or double-count
   * toward the game's 10-stage completion. */
  isReplay: boolean;
  onExit: () => void;
  onOpenStats: () => void;
};
