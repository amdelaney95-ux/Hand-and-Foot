# Hand & Foot — Project Handoff

Everything needed to pick this project up in a fresh conversation. Written for
whoever (or whichever AI assistant) continues refinement from here.

---

## 1. What this is

A custom house-rules implementation of the card game **Hand & Foot**, playable by
2–6 people on separate devices over the internet. It is a **single self-contained
HTML file** (`handfoot.html`, ~2,050 lines) containing the game engine, UI, and
cross-device sync. No build step and no server of our own.

It has been through roughly a dozen real multiplayer playtest sessions and
several rounds of bug fixes and feature work.

### How it actually runs — two backends, one file

All shared state goes through a **storage adapter**, picked by `HF_CONFIG` at the top
of the script (`backend: 'auto'` by default):

| | **Firebase** (GitHub Pages) | **Claude artifact storage** |
|---|---|---|
| Picked by `auto` when | not on a Claude host, and `HF_CONFIG.firebase` filled in | `window.storage` exists (i.e. running inside Claude) |
| Transport | Realtime Database, live push | `window.storage`, polled every ~1.8s |
| Writes | **atomic** transactions | read → mutate → write (not atomic) |
| Player needs | just the URL | a Claude account (see §7) |
| Seat memory | `localStorage`, one-tap rejoin | rejoin by typing the same name |
| After a change | `git push` (Pages redeploys) | re-publish the artifact |

Setup for the Firebase side is in **`FIREBASE_SETUP.md`**. Firebase keys belong in
`HF_CONFIG` and are safe to commit (a web config only identifies the project; the
database rules in `firebase-rules.json` are what protect it).

Claude-side facts that still apply there: storage needs a Pro/Max/Team/Enterprise plan;
a published link keeps serving the old version until you re-publish; unpublishing wipes
stored data and that artifact can't be re-published. A downloaded copy opened straight
from disk has neither backend and says so on the start screen.

`?backend=firebase` / `?backend=claude` overrides the setting for one visit.

**Planned next (user's cruise, no internet):** an offline pass-and-play mode, as a third
adapter/setting, not a fork. See §7.

---

## 2. Current state

**Everything on the feature list is done and playtested.** The last round closed
out with no known open bugs.

- Test suite: **29 suites, all passing** (`bash tests/run-all.sh`), including a
  jsdom end-to-end sync test that drives the real page as several devices
- Git: working tree clean, `playtested-baseline` tag is the pre-feature rollback point
- **Firebase backend is built and tested against a faithful fake, but has not yet
  been run against a real Firebase project.** First real run happens when the user
  completes `FIREBASE_SETUP.md`; treat the first playtest on it as the real test.

### Verify it yourself in a new session

```bash
cd handfoot-game
(cd tests && npm install)  # once: jsdom for the end-to-end test (skipped if absent)
bash tests/run-all.sh      # syntax check + engine extract + all suites
git log --oneline          # full change history
```

---

## 3. The house rules (authoritative)

These differ from standard Hand & Foot in several places. The user is the source
of truth on rules — **ask before changing game logic, don't assume standard rules
apply.**

**Setup**
- Decks = players + 1 (6 players → 7 decks). Each deck is a full 54 (52 + 2 Jokers).
- Each player gets two 13-card piles: **Hand** (played first) and **Foot**
  (face-down until the Hand is emptied).

**Drawing — four options per turn**
1. Draw 2 from stock.
2. Draw 1 from stock, *see it*, then choose the second (stock or discard).
3. Take the top discard, *see it*, then draw 1 from stock (sequential, required).
4. **Matched pickup** — holding 2 naturals matching the top discard, lay those
   two plus the top card as a meld, then take **up to 7 cards total from the
   pile, with the top card counting toward that 7** (so an 8-card pile leaves 1
   behind). Requires either the initial meld already down, *or* that this
   pickup plus any other melds staged in the same action reaches the threshold.

**Cards**
- **Wilds**: 2s and Jokers. Every meld needs *more naturals than wilds*.
- **Black 3s**: freeze the discard pile against pickup while on top. Never
  meldable. Discardable freely.
- **Red 3s**: auto-play the instant they're drawn or dealt, replaced by a fresh
  draw (recursively). Worth **+100** each. If stuck in hand or foot at round
  end, worth only 5 (a penalty, not the bonus).

**Melds & canastas**
- 7+ cards of a rank. **Clean** (no wilds) = 300, **dirty** = 100.
- **Wild canasta** (7 cards of only 2s/Jokers) = **1500**, and counts as the
  *clean* side of the go-out requirement. Only the 1500 — no extra 300.
- A completed canasta stays **open for overflow** indefinitely — extra cards add
  their face value only, never a second bonus.

**Initial meld thresholds by hand:** 50 / 90 / 120 / 150. All-or-nothing per turn.

**Going out**
- Requires an empty Hand *and* Foot, plus at least one clean and one dirty canasta.
- **Melding your hand to empty auto-opens your foot and the turn continues.**
  Discarding your last card still ends the turn normally.
- Melding through both hand and foot in one turn without ever discarding is a
  valid go-out.
- **Floating** = 0 cards, foot open, requirements not yet met. If a meld leaves
  you floating with nothing to play, the turn now **auto-ends**.

**Scoring:** card values (3–7 = 5, 8–K = 10, A/2 = 20, Joker = 50) + canasta
bonuses + red-3 bonuses − everything left in hand and foot. Exactly 4 hands;
highest cumulative total wins.

---

## 4. Architecture

Single file, sections in this order inside one `<script>` block:

| Section | What lives there |
|---|---|
| Constants & card helpers | `RANK_ORDER`, deck building, sorting, `FOOT_ICON_SVG` |
| **Game engine** | deal, draw, meld, pickup, scoring, turn flow — **DOM-free** |
| Storage adapters | `createClaudeAdapter`, `createFirebaseAdapter`, `chooseBackend` |
| Sync | `initBackend`, `startSync`/`stopSync`, seat memory (`saveSession` etc.) |
| Client UI state | the big `ui` object |
| Actions | `act*` wrappers that call engine fns via `pushState` |
| Rendering | landing / lobby / table / modals / overlays |

### The two rules that keep this codebase sane

**1. The engine section is deliberately DOM-free.** That's what lets
`tests/extract-engine.py` pull it out and run it in plain Node with no browser.
If you add engine logic that touches `document` or `window`, you break the
entire test suite's ability to run. Keep engine and rendering separate.

**2. Shared state vs. client state.** `netState` is synced to every player.
The `ui` object is local to one browser and never synced. Anything cosmetic or
personal — hand order, meld order, animations, highlights, chimes — belongs in
`ui`. Several features were built specifically this way (see below).

**3. Every shared-state change goes through `pushState(mutator)` → `backend.update()`.**
The mutator runs against the **latest stored state**, not this client's copy, and on
Firebase it may run **more than once** (transactions retry on conflict). So a mutator
must only edit the state it's handed. All current ones are just engine calls, and
they're safe. Two guards in `pushState` exist *because* of fresh-state semantics:
- **in-flight guard:** a double-tap is ignored while the first is saving. Otherwise a
  double-tapped "Draw 2" genuinely draws 4 (the old copy-and-overwrite approach hid
  this by accident).
- **turn guard:** during `playing`, only the active player can write. A stale client
  is refused instead of acting out of turn.
Host actions (next hand, new game) check their expected phase for the same reason.
Never write to storage any other way; the adapters are the only code that knows a
storage API exists.

**4. Firebase stores each room as ONE JSON string** (`{json, rev, updatedAt}`), on
purpose: Realtime Database drops empty arrays and nulls and can turn arrays into
objects, and this state is full of all three. Don't "optimize" it into a native tree.

### Rendering model — important gotcha

`render()` replaces `#app`'s **entire innerHTML** on every call, and it's called
on every incoming update (Firebase push, or Claude poll every ~1.8s) *and* a
1-second timer tick. Consequences:

- Any DOM state not derived from `netState`/`ui` is destroyed constantly. The
  table log's scroll position needs explicit capture-and-restore around the
  rebuild (already implemented, see `render()`).
- CSS animations would restart on every render. All animations solve this by
  computing a **negative `animation-delay` from real elapsed time**, so a
  re-render mid-animation resumes rather than restarts. Follow that pattern for
  any new animation.

### Client-only features (never touch shared state)

- Hand reordering + sort — tap-to-pick-up, tap-to-place (chosen over drag-and-drop
  because HTML5 drag is unreliable on touch, and a live drag would fight the
  full re-render)
- Personal meld reordering (the *ascending default* is shared-by-computation:
  every client sorts the same deterministic way, so no sync is needed)
- Newly-drawn card highlight, draw/deal/red-3 animations
- Turn-start chime (private to that player) and red-3 chime (fires for everyone,
  triggered by watching the combined red-3 count across all players)

---

## 5. Git

Repo is at the root of the attached bundle. Clean tree. `git log` for the full history.

```
ae88cab  Item 2: preserve table log scroll position across re-renders
ba9354a  Item 4: auto-end turn when melding leaves you floating
cfea478  Items 1 and 3: text fix + meld log distinction
7dcf0af  Make the 'newly drawn' card highlight more eye-catching
1242a94  Playtest round: wild sort fix, turn timer, chimes, pile visuals
5e1c345  Add scoped undo: back out of discard phase
c833403  Sort melds boards ascending, with personal reorder
3eedd73  Add 'Floating' indicator
c661ce4  Cover initial-deal edge case for red-3 celebration
35287fd  Add red-3 celebration animation
f677cfe  Add scoreboard: placement + standings/breakdowns
5dad4dc  Fix: matched pickup blocked selecting extra cards for initial meld
c2c6fd7  QoL: carry over single selected card as discard choice
2286671  Clean/dirty visual indicator for opponent meld chips
d1e404b  Rework deal animation: real hand cards deal in
ae4910f  Add draw and initial-deal animations
93ab815  Highlight newly-drawn cards
00815e1  Add manual hand reordering + sort button
10d5ab8  Initial commit  [tag: playtested-baseline]
```

`playtested-baseline` is the known-good pre-feature-work rollback point.

Commit messages are intentionally detailed — they record *why* decisions were
made, alternatives rejected, and what was verified. Worth reading before
changing something that looks odd; it was probably deliberate.

---

## 6. Testing

Node + Python 3. One npm package, jsdom, and only for the end-to-end test.

```bash
(cd tests && npm install)   # once; installs jsdom
bash tests/run-all.sh
```

That script: syntax-checks the script block → re-extracts the engine to
`tests/engine.js` → runs every suite. Without jsdom the e2e suite reports
**SKIPPED** (not a silent pass) and the rest still run.

Three kinds of test:
- **Engine tests** `eval()` the extracted engine and drive it directly.
- **UI-logic tests** re-implement one function against mock state.
- **`test_e2e_sync.js`** loads the *real* `handfoot.html` in jsdom as several
  simulated devices and clicks the actual buttons, against two fakes:
  a Firebase fake that reproduces Realtime Database transaction semantics
  (null first run when uncached, compare-and-set with re-run on conflict,
  `undefined` aborts, pushes to all listeners) and a Claude `window.storage`
  fake (throws on missing keys, like the real one). It covers simultaneous joins,
  double-tap, out-of-turn, one-tap rejoin, both backends' auto-detection, and
  config errors. **When you change sync code, this is the test that matters.**
  It was sanity-checked by sabotaging compare-and-set: the join test then fails
  (the uncached null write deletes the room), so it does detect broken atomicity.

**Workflow that worked well and is worth continuing:**
1. Make the change
2. Syntax check
3. Re-extract engine, run the full suite
4. Write a *targeted* test for the specific new behavior
5. Commit with a message explaining the reasoning
6. Copy to outputs and hand over for playtesting

**Notes:**
- `tests/engine.js` is generated — don't hand-edit it.
- `test.js` is a 4,000-turn simulation across 2/3/4/6 players that asserts card
  conservation (no cards created or destroyed). It's the best broad safety net;
  run it after any engine change.
- The log-scroll fix predates jsdom being available here and is tested against a
  hand-built mock; it could now be moved into the jsdom harness.
- The Firebase fake is faithful to the documented behavior the code relies on, but it
  is still a fake. The real Firebase SDK can't reach a database from this sandbox, and
  `firebase-rules.json` hasn't been run through the rules emulator (it needs a Java
  download that isn't reachable here). The Firebase console validates rule syntax on
  publish.
- A long-running flaky assertion in `test2.js` was fixed during handoff prep
  (the setup wasn't clearing p1's auto-banked red 3). Suite is fully
  deterministic now — a failure means something is actually wrong.

---

## 7. Known limitations & deliberate decisions

**Platform limits (can't be fixed in code)**
- *(Claude backend only; the Firebase/GitHub Pages backend needs no account.)*
  Login required to view the published artifact. Anthropic's docs say Pro-plan
  published artifacts should be public, so this contradicts documented behavior.
  Investigated at length; ruled out wrong-link-type, Team/Enterprise org
  restriction, and AI-powered-artifact gating. **Unresolved — user tabled it**
  since all players have Claude accounts. If revisited, the remaining move is
  contacting Anthropic support with screenshots.
- On the Claude backend the game never touches `localStorage`, so a refresh loses
  your seat there. Rejoining with the **same name** (case-insensitive) restores it.
  On Firebase the seat is remembered and the start screen offers one-tap rejoin. Confirmed
  working hours later — the host does *not* need to stay online, and game state
  survives independently of any browser session.
- Shared room state is visible to anyone with the room code. Fine for a trusted
  group; not cheat-proof. Fixing it means server-side game logic (e.g. PartyKit or
  Cloud Functions owning the deck), which is a bigger project than hosting.
- Claude-backend writes aren't atomic, so two players writing at the same instant can
  collide. In practice that means lobby joins, since in-game only the active player
  writes. Firebase transactions fix this there.
- Firebase rooms are never deleted. At ~9–17 KB each this is irrelevant for years
  on the free tier, but a cleanup of rooms idle for 30+ days would be easy to add.

**Offline play (researched, not built yet)**
- Pure phone-to-phone Android↔iPhone play without internet isn't practical in a
  browser: iOS Safari has no Web Bluetooth, ship Wi-Fi usually blocks device-to-
  device traffic, and WebRTC needs QR-code signaling per player.
- Two workable options, both planned as extra adapters, not forks: **pass-and-play**
  on one device (in-memory state, a "hand the phone to X" privacy screen between
  turns; smallest and most reliable), or an **Android phone as a local host** on its
  own hotspot, running a tiny server via Termux, with everyone else joining by
  browser (iPhones can't host). Rehearse with all phones in airplane mode before relying on it.

**Deliberate scope choices**
- The undo button reverses *only* the meld→discard phase flip, and only before
  an actual discard. This is safe because reaching discard phase guarantees no
  cards have moved. **A general undo system was deliberately not built** —
  unwinding real card movement across players is a much riskier problem.
- The wild-redirect chooser UI exists in the main melding flow but not inside
  the matched-pickup staging panel (that path still auto-routes wild-only groups
  to the wild canasta). Never came up in play.
- Turn timer is display-only. Turn *limits* were mentioned as a possible future
  feature.

---

## 8. Working with this user

Context that made previous sessions go smoothly:

- **They playtest with real users and return with batched, specific feedback.**
  Expect lists of 4–6 items. Working through them one at a time, shipping each,
  worked well.
- **They care about correctness over speed.** They explicitly asked early on not
  to guess at game logic and to ask for clarification instead. Do that — several
  rules here are genuinely non-standard.
- **They flag risky changes before approving them** ("I'm worried this will break
  things — is it safe?"). Give an honest technical assessment and scope the
  change narrowly rather than reassuring them.
- **They appreciate being told when something is a platform limit rather than a
  fixable bug**, and when a test failure is in the test rather than the code.
- Several early "bugs" were actually mistakes in my own test setup. Verify which
  before reporting a problem.
- The pattern each round: implement → syntax check → full suite → targeted test →
  commit → present file → they re-publish and playtest.

---

## 9. Starting a new chat

Attach the repo bundle and try something like:

> Attached is my Hand & Foot card game project — a single-file HTML multiplayer
> game that runs on GitHub Pages with Firebase, and also as a Claude artifact.
> Read `HANDOFF.md` first, and `README.md` for the full rules. The repo has full
> git history and a test suite (`cd tests && npm install`, then
> `bash tests/run-all.sh`). I have another round of playtest feedback to work
> through.

Suggested first moves in a new session:
1. Read `HANDOFF.md` and `README.md`
2. `cd tests && npm install`, then `bash tests/run-all.sh` to confirm a clean baseline
3. Skim `git log` for context on recent decisions
4. Ask about anything rule-related before changing engine logic

Note: the working directory in these sessions can reset between conversations. The
bundle is the source of truth; restore from it first rather than assuming earlier
files are still on disk.
