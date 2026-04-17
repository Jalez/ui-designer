# Handoff: Work Not In `ui-designer`

## Current baseline

- Current branch: `ui-designer`
- Current HEAD: includes combobox cherry-picks + lockfile sync (exact SHA: `git rev-parse HEAD`)
- This branch was intentionally rebuilt on top of known-good custom Yjs commit `a895aab` plus selected safe follow-up commits.
- This rebuilt branch passed the available collaboration Playwright checks I ran:
  - `pw:local-group`
  - `pw:classroom-churn`
  - `pw:same-user`
  - `pw:same-user-blocked`
  - `pw:refresh-desync`
  - `pw:latency`
  - `pw:text-production`
  - `pw:text-production-hard`
  - `pw:ws-recovery`
  - `pw:ws-recovery-harsh`

## Purpose of this note

This file lists the meaningful collaboration work that is **not** in `ui-designer` right now, so another model can resume without re-tracing the history.

## Important refs

- `compare/prod-custom-yjs-a895aabb`
  - Known-good old custom-Yjs base.
- `investigate/hocuspocus-local-group-flake`
  - Hocuspocus migration branch plus later investigation work.
- `backup/ui-designer-before-custom-yjs-reset-20260320-001816`
  - Backup of the earlier `ui-designer` state before the branch was rebuilt.
- `stash@{0}`
  - `backup hocuspocus investigation before custom-yjs rebuild`
- `stash@{1}`
  - `move hocuspocus investigation to ui-designer`

## Major work missing from `ui-designer`

### 1. Hocuspocus cutover

Missing commits:

- `2878775` `feat(collaboration): cut over Yjs transport to hocuspocus`
- `3cfcaec` `test(playwright): stabilize hocuspocus collaboration coverage`

What they did at a high level:

- Added same-port Hocuspocus integration in the ws server.
- Added Hocuspocus-backed document load/store and room-doc persistence.
- Switched client collaboration transport from custom `yjs-protocol` to Hocuspocus.
- Added Hocuspocus auth token handling and related server/client glue.
- Reworked Playwright helpers to better tolerate provider-backed editor timing.

Important status note:

- This branch later became unstable enough that I did **not** keep it in `ui-designer`.
- The biggest unresolved area was late-join / readiness / presence behavior under Hocuspocus, especially around `pw:local-group`.

### 2. Later Hocuspocus investigation work

Reachable commit:

- `075606c` `wip: preserve hocuspocus local-group investigation`

This is **not** a clean feature commit. It is a preserved WIP snapshot.

Key files touched there:

- `lib/collaboration/CollaborationProvider.tsx`
- `components/Editors/CodeEditor/CodeEditor.tsx`
- `components/Editors/CodeEditor/useYjsCodeEditorCollaboration.ts`
- `scripts/playwright-local-group-smoke.mjs`
- `ws-server/server.mjs`
- docs cleanup around the migration

What that WIP was trying to do:

- debug and stabilize Hocuspocus `local-group`
- tighten editor readiness checks
- expose extra Playwright/editor debugging hooks
- reduce stale transport scaffolding

Why it was not kept:

- it was not stable enough to replace the known-good custom-Yjs path
- it mixed useful investigation with cleanup and test-harness work

### 3. Shared combobox (react-select) — **restored on `ui-designer`**

These three commits were cherry-picked from the pre-rebuild line (same hashes):

- `0a6e5b1` `feat(ui): add shared react-select combobox foundation` → adds `components/ui/combobox.tsx`, `command.tsx`, `cmdk` + `react-select`
- `c0ffa1b` `refactor(pickers): migrate group and model selectors to shared combobox` → `GroupSelector` (used from **game** `GamePageClient` group flow / lobby), `InviteToGroupDialog`, `CreatorGroupDetailsDialog`, `ServiceDefaultModelSelector`
- `f77156a` `refactor(creator-settings): use shared combobox and remove unused settings modal` → `app/creator/[gameId]/settings/page.tsx`; removes unused `components/Navbar/GameSettings.tsx`

If `pnpm-lock.yaml` drifts after install, run `pnpm install` and commit the lockfile.

### 4. Other UI work that may still be only on the Hocuspocus branch

Previously listed together with combobox; combobox is now merged as above. Remaining items if any should be re-audited against current `ui-designer`.

Important correction:

- `0f2368f` `Improve screenshot sharpness and diff accuracy` **is now included** on `ui-designer` as cherry-pick `28b5bc5`.

## Creator level-sync logic: status and intended shape

### Important truth

There is **no dedicated committed hash** for the later creator level-list sync fix.

I checked:

- normal reachable history
- side branches
- current stashes

The exact fix was never captured as its own clean commit.

### What the bug was

When two users were on the creator route and one user created a new level, the other user did not see the updated level list.

The underlying problem was not Yjs text sync itself. The problem was that room structure changes were outside normal text sync:

- level add/remove/import changed the room structure
- only the initiating tab updated immediately
- the other creator tab did not receive a fresh room snapshot that it would actually apply

### Intended fix shape

The later patch that addressed this had this structure:

Server side:

- add a creator-room room-structure sync message in `ws-server/socket-handlers/progress.mjs`
- schema it in `ws-server/ws-protocol-schema.mjs`
- broadcast fresh room snapshot / map state when creator structure changes

Client collaboration side:

- expose the new message through `lib/collaboration/hooks/useCollaborationConnection.ts`
- route it through `lib/collaboration/CollaborationProvider.tsx`

Creator UI side:

- make the creator route actually re-apply incoming room snapshots instead of ignoring them
- preserve the currently selected level when possible
- emit the fresh room structure after:
  - new level creation
  - level removal
  - imported map / structural changes

Files I previously touched for that fix:

- `components/App.tsx`
- `components/CreatorControls/hooks/useNewLevel.ts`
- `components/CreatorControls/hooks/useLevelRemover.ts`
- `components/CreatorControls/MapEditor.tsx`
- `lib/collaboration/hooks/useCollaborationConnection.ts`
- `lib/collaboration/CollaborationProvider.tsx`
- `ws-server/socket-handlers/progress.mjs`
- `ws-server/ws-protocol-schema.mjs`

Test shape I added at the time:

- unit coverage in `ws-server/socket-handlers/progress.test.mjs`

What is missing right now:

- that exact patch is not present in `ui-designer`
- there is no committed hash to cherry-pick
- it would need to be reimplemented cleanly on top of the current custom-Yjs branch

## Practical next steps for another model

### If the goal is stability

Stay on `ui-designer` and keep the custom-Yjs baseline.

### If the goal is to recover creator level-list sync

Reimplement it cleanly on top of current `ui-designer` using the design above:

1. add explicit creator room-structure sync ws message
2. emit it after level add/remove/import
3. let the creator route reapply incoming room snapshots
4. keep selected level stable where possible
5. add a browser-level regression test if possible

### If the goal is to resume Hocuspocus work later

Start from:

- branch `investigate/hocuspocus-local-group-flake`
- commit `075606c`
- stashes `stash@{0}` and `stash@{1}`

But treat that line of work as investigation, not production-ready state.

## Useful commands

Inspect the Hocuspocus side branch against current `ui-designer`:

```bash
git log --oneline ui-designer..investigate/hocuspocus-local-group-flake
git diff --stat ui-designer..investigate/hocuspocus-local-group-flake
```

Inspect the preserved stashes:

```bash
git stash list
git stash show --stat stash@{0}
git stash show --stat stash@{1}
```

Run the collaboration Playwright checks that were green on current `ui-designer`:

```bash
npm run pw:local-group
npm run pw:classroom-churn
npm run pw:same-user
npm run pw:same-user-blocked
npm run pw:refresh-desync
npm run pw:latency
npm run pw:text-production
npm run pw:text-production-hard
PLAYWRIGHT_ALLOW_WS_CRASH=true npm run pw:ws-recovery
PLAYWRIGHT_ALLOW_WS_CRASH=true npm run pw:ws-recovery-harsh
```
