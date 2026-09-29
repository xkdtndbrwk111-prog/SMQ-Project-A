# PROJECT A_TECHNICAL_AUDIT

## 1. ARCHITECTURE SUMMARY

Project A is a Google Apps Script web application that provides a player/game frontend, specifically a "SUPER MARIO QUIZ". It interacts with a backend system (Project B) to retrieve questions (cartridges) and store telemetry/rankings.

Key architecture components:
- **Client-Side (Game.html, Styles.html, Index.html):** Handles all game logic, rendering, audio, and user interactions. State is managed locally in JS (`gameState`, `soloState`). Communication with the backend is done asynchronously via `google.script.run`.
- **Server-Side (Code.gs, UsageRollupU3S.gs):** Apps Script backend exposing RPCs. It reads game configurations, questions from spreadsheets (acting as a backend), handles public/private ranking submissions, and writes usage telemetry (`EVENT_LOG`). It also implements a read cache using `CacheService` to reduce spreadsheet operations.

Major flows:
- **Startup & Cartridge Selection:** The client fetches a list of available games. The user selects a mode (SOLO or TEAM), grade, subject, and cartridge(s).
- **Game Session:** Questions are loaded and cached. A 5x5 grid (25 questions) is presented.
  - **TEAM Mode:** Turn-based gameplay where teams select questions, answer them, and receive items (e.g., COIN, SHELL, BOWSER) that affect scores. Scores are updated locally.
  - **SOLO Mode:** Single-player speedrun with DDR-style judgement based on answer time. No items, just raw score based on time and correct answers.
- **Completion & Ranking:** After all questions are answered or time/turns run out, the game ends. In SOLO mode, scores can be submitted to a global ranking board.
- **Telemetry:** Usage data is appended to an `EVENT_LOG` sheet. `UsageRollupU3S.gs` creates a shadow rollup of this data.

## 2. BLOCKER / REAL BUG

- Currently, no blockers or real bugs with concrete source evidence have been identified that bypass existing safeguards.

## 3. RECOMMENDED IMPROVEMENT

### Improvement 1: Centralized Constants
- **file**: `Code.gs`, `Game.html`
- **evidence**: Hardcoded strings like `'모둠점수'`, `'SOLO_RANKING'`, `'EASY'`, `'HARD'` are scattered across JS and Apps Script.
- **recommended minimal fix**: Extract these into a configuration object or constants at the top of the respective files to prevent typos and ease future modifications.

### Improvement 2: Consolidate Modal Reset/Return Logic
- **file**: `Game.html`
- **evidence**: Functions like `returnTeamGameToSetup274` and others that handle resetting state lack resetting `itemEffectProcessing` or `itemSelectionLocked`. If a user manages to leave a game via a "back" button mid-item selection, these flags could theoretically stay `true` or get stuck, locking out future interactions.
- **recommended minimal fix**: Centralize all variable resets into one robust reset function that runs whenever the game view changes or aborts.

## 4. LOW PRIORITY / CLEANUP

- **Dead Code**: The `Game.html` file contains extensive commented-out HTML and CSS blocks from previous versions. These should be removed as they are tracked in version control anyway, improving load time and readability.
- **Readability**: Huge inline SVG/Base64 image strings in JS constants (e.g., `ASSETS`). Moving these to a separate asset file or loading them via external URLs would significantly clean up the code.

## 5. DO NOT TOUCH / HIGH-RISK AREAS

- **Ranking Locks**: The `LockService.getScriptLock()` usage in `saveSoloRanking` and `savePrivateSoloRankingRC3` is critical to prevent data corruption under concurrent load. Do not alter the lock acquisition/release flow.
- **Cache Keys & Invalidation**: The logic around `GAME_SHEETS_CACHE_KEY_V106` and related cache functions must remain intact to prevent Google Sheets API quota limits from being exhausted during high traffic.
- **UsageRollupU3S**: As per instructions, "Project A owns usage append / rollup", "rollup is shadow-only", "no raw deletion". Do not touch the logic appending to `EVENT_LOG`.

## 6. INTERFACE CHANGE REQUESTS

- None currently identified. The interface with Project B (Spreadsheet as backend) seems stable, though reliant on specific sheet names and column structures.

## 7. TEST GAPS

- **Concurrency Testing**: Apps Script's `LockService` is used, but it's hard to verify behavior under heavy concurrent user load (e.g., 50 students submitting rankings simultaneously) without a load testing tool.
- **Cache Distribution**: Apps Script `CacheService` is not strongly consistent. Tests are needed to see how often a user sees stale data right after an update.

## 8. TOP 5 NEXT ACTIONS

1. **Clean up Dead Code**: Remove the massive blocks of commented-out legacy code in `Game.html` and `Styles.html` to improve maintainability.
2. **Extract Base64 Assets**: Move the large base64 image strings out of the main logic flow into a dedicated configuration or asset section.
3. **Consolidate State Management**: Consider using a centralized state management pattern or class to handle `gameState` and `soloState` transitions more robustly, especially when navigating between modes.
4. **Implement Global Error Handling**: Wrap `google.script.run` calls in a consistent error-handling utility to ensure all failed network requests provide user-friendly feedback and revert UI state.
5. **Optimize DOM Updates**: Review areas where `requestAnimationFrame` is heavily chained or where layout thrashing might occur during rapid UI transitions.

## 9. EXAMINED BUT NOT CONFIRMED

### TEAM double item execution
The item transaction path was examined. Synchronous guards (`itemSelectionLocked` and `itemEffectProcessing`) are in place. `itemEffectProcessing` is set to `true` at the beginning of `executeItemWithTarget` and is not released until the modal closes in `closeModalAndNextTurn`. Thus, a double execution via the UI is mitigated.

### SOLO ranking stale cache
Client and server cache invalidation was examined. The PUBLIC ranking path uses `invalidateSoloRankCacheV106_` upon successful save, and the client increments a token `soloRankRequestToken` so an older in-flight GET request doesn't overwrite a newly saved ranking. Then the client updates its local cache from the authoritative save response. The PRIVATE path handles invalidation manually by removing `SMQ_PRIVATE_RANK_RC3_...` from the script cache. These mechanisms mitigate the risk of stale cache behavior.

### Async/stale-response safety
Callbacks for server requests (e.g. `getGameDataBySheets`, `savePrivateSoloRankingRC3`) have been verified to check epoch tokens (like `cartridgeLoadRequestToken186` and `soloRankSubmitToken189`). If the user leaves the screen before the response comes back, these guards prevent state corruption.

### Full reset invariants: `returnTeamGameToSetup274`
`returnTeamGameToSetup274()` does not explicitly reset `itemEffectProcessing` or `itemSelectionLocked`. However, these are reset explicitly when a new turn flows normally, such as in `showPipes()` when a correct answer is given, so the states wouldn't incorrectly carry across sessions into active use without being properly reset first. This was checked and determined to be safe.
