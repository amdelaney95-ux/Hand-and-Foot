# Hand & Foot — Custom House Rules

A single-file, browser-playable implementation of a custom house-rules version
of Hand & Foot, for 2–6 players across separate devices.

**New here? Read `HANDOFF.md` first** — it covers architecture, testing, known
limitations, and how to continue development. This file is the rules and
feature reference.

---

## Running it

One file, two ways to host it. `handfoot.html` detects where it's running and picks the
right storage (`HF_CONFIG.backend: 'auto'`); `?backend=firebase` or `?backend=claude`
overrides it for one visit.

**GitHub Pages + Firebase (recommended).** A normal web page: no accounts, live
updates, and a remembered seat with one-tap rejoin after a refresh. One-time setup:
**see `FIREBASE_SETUP.md`**. After that, `git push` deploys every change.

**Claude artifact.** Publish `handfoot.html` from Claude and share the
`claude.ai/public/artifacts/...` link. Needs a Pro/Max/Team/Enterprise plan for
storage; viewers currently need a Claude login; re-publish after every change.
Refreshing loses your seat; rejoin with the **same name** (case-insensitive).

Either way, game state lives on the backend, not in anyone's browser: the host can
close the page and the game can resume hours or days later. Opening a downloaded copy
straight from disk has no backend, and the start screen says so.

---

## Rules

### Setup
- Decks = players + 1 (6 players = 7 decks), each a full 54 cards.
- Two 13-card piles per player: **Hand** (organized immediately) and **Foot**
  (face-down until the Hand is emptied).

### Drawing (four options)
1. **Draw 2 from stock.**
2. **Draw 1 from stock, then choose** the second card (stock or discard) — lets
   you see the first before deciding.
3. **Take the top discard, then draw from stock** — sequential, not atomic; the
   stock draw is a separate required step.
4. **Matched pickup** — with 2 naturals matching the top discard (pile not
   frozen), lay them plus the top card as a meld, then take **up to 7 cards
   total from the pile, the top card counting toward that 7** (an 8-card pile
   leaves 1 behind). Requires the initial meld already down, *or* that this
   pickup plus other melds staged in the same action clears the threshold.

### Cards
- **Wilds** — 2s and Jokers. Every meld needs more naturals than wilds.
- **Black 3s** — freeze the discard pile against pickup while on top; never
  meldable; discardable freely.
- **Red 3s** — auto-play the moment they're drawn or dealt (replaced by a fresh
  draw, recursively). Worth **+100** each. Left in hand or foot at round end,
  worth only 5 as a penalty.

### Melds and canastas
- 7+ cards of a rank. **Clean** (no wilds) = 300, **dirty** = 100.
- **Wild canasta** — 7 cards of only 2s/Jokers = **1500 flat**, and counts as
  the *clean* side of the go-out requirement (1500 only, no extra 300).
- Completed canastas stay **open for overflow** — extra cards add face value
  only, never a second bonus.
- Wild-only selections can be **redirected** into an existing rank meld instead
  of the wild canasta, when the naturals-outnumber-wilds rule still holds.

### Initial meld thresholds
Hand 1 = 50, Hand 2 = 90, Hand 3 = 120, Hand 4 = 150. All-or-nothing per turn.
Melding can always be skipped, even before the threshold is met.

### Going out
- Empty Hand **and** Foot, with at least one clean and one dirty canasta (a wild
  canasta counts as clean).
- **Melding your hand to zero auto-opens your foot and the turn continues** —
  keep melding from the new cards. Discarding your last card still ends the turn.
- Melding through hand *and* foot in one turn without discarding is a valid
  go-out.
- **Floating** — 0 cards, foot open, requirements unmet. If a meld leaves you
  floating with nothing playable, the turn ends automatically.

### Scoring
Card values (3–7 = 5, 8–K = 10, A/2 = 20, Joker = 50) + canasta bonuses +
(red 3s × 100) − everything left in hand and foot. Exactly 4 hands; highest
cumulative total wins. A full per-hand breakdown is shown at each hand's end and
in the scoreboard.

---

## Features

**Gameplay**
- Scoped undo — back out of discard phase before actually discarding
- Auto-end turn when floating with nothing playable
- Skip melding at any point

**Information**
- Scoreboard viewable any time: standings, current placement, and per-hand
  score breakdowns for every completed hand
- Placement shown next to your total in the top bar
- Opponent chips: hand/foot counts, meld progress, red-3 tally, floating status
- Completed canastas marked red-♥ (clean) / black-♠ (dirty), mirroring the
  physical convention of capping with a red or black card; in-progress melds
  holding wilds show a muted wild count
- Live turn timer (display only)
- Table log distinguishing new melds from additions to existing ones

**Feel**
- Staggered deal-in animation on real hand cards
- Centered popup of newly drawn cards
- Red-3 celebration with sparkle burst, then the normal draw popup
- Red border on cards drawn this turn
- Turn-start chime (private) and red-3 chime (heard by everyone) — synthesized
  via Web Audio, no external files

**Organization**
- Hand reordering (tap to pick up, tap to place) + sort ascending
- Melds sorted ascending for everyone by default, with a personal reorder
  option that affects only your own view

---

## Development

```bash
bash tests/run-all.sh    # syntax check + engine extract + all 27 test suites
```

Node and Python 3. `(cd tests && npm install)` adds jsdom for the end-to-end sync
test (skipped, and reported as skipped, without it). See `HANDOFF.md` for architecture
notes, the storage-adapter rules, the client-vs-shared-state split, the re-render
gotcha, and testing conventions.

### Layout
```
handfoot.html            the entire game (HF_CONFIG settings at the top of the script)
index.html               GitHub Pages entry point; forwards to handfoot.html
FIREBASE_SETUP.md        one-time Firebase + GitHub Pages setup
firebase-rules.json      database security rules to paste into Firebase
HANDOFF.md               start here — architecture, testing, limitations
README.md                this file — rules and features
tests/run-all.sh         full verification pass
tests/extract-engine.py  pulls the DOM-free engine out of the HTML
tests/engine.js          generated — do not hand-edit
tests/test*.js           29 suites (test_e2e_sync.js needs jsdom: cd tests && npm install)
tests/package.json       jsdom, for the end-to-end test only
```
