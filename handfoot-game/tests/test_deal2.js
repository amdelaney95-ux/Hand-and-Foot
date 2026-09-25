let ui = { dealAnimation: null };
const DEAL_STAGGER_MS = 90;
const DEAL_POP_MS = 380;

function dealDelayForIndex(i){
  if(!ui.dealAnimation) return null;
  const elapsed = Date.now() - ui.dealAnimation.startedAt;
  if(elapsed > ui.dealAnimation.totalMs) return null;
  return i*DEAL_STAGGER_MS - elapsed;
}

let failures=0;
function assert(cond,msg){ if(!cond){console.log('FAIL:',msg); failures++;} else {console.log('ok:',msg);} }

// No animation active -> no delay applied to any card
assert(dealDelayForIndex(0)===null, 'no deal animation active -> null delay (card renders normally)');

// Fresh trigger: card 0 should start almost immediately (near-zero delay), later cards wait longer
const handSize = 13;
ui.dealAnimation = { startedAt: Date.now(), totalMs: handSize*DEAL_STAGGER_MS + DEAL_POP_MS + 250 };
const d0 = dealDelayForIndex(0);
const d5 = dealDelayForIndex(5);
const d12 = dealDelayForIndex(12);
assert(d0 !== null && Math.abs(d0) < 20, `card 0 starts almost immediately (got ${d0}ms)`);
assert(d5 > 400 && d5 < 500, `card 5 waits roughly 5*90=450ms (got ${d5}ms)`);
assert(d12 > 1000 && d12 < 1150, `card 12 (last) waits roughly 12*90=1080ms (got ${d12}ms)`);
assert(d0 < d5 && d5 < d12, 'delays increase monotonically by card index, i.e. cards deal in left-to-right order');

// Simulate a re-render landing mid-sequence (e.g. elapsed = 500ms): earlier cards should show
// a NEGATIVE delay (already past their slot -> resume/skip ahead, don't restart), later cards
// should still show a smaller-but-still-positive delay (haven't arrived yet).
ui.dealAnimation.startedAt = Date.now() - 500;
const d0Mid = dealDelayForIndex(0);
const d12Mid = dealDelayForIndex(12);
assert(d0Mid < 0, `card 0's slot (0ms) has long passed by elapsed=500ms -> negative delay so it does NOT restart (got ${d0Mid}ms)`);
assert(d12Mid > 0, `card 12's slot (1080ms) has not arrived yet at elapsed=500ms -> still a positive wait (got ${d12Mid}ms)`);

// After the whole window has elapsed, every index returns null (deal-in class stops applying)
ui.dealAnimation.startedAt = Date.now() - (ui.dealAnimation.totalMs + 500);
assert(dealDelayForIndex(0)===null, 'after the full window elapses, delay is null for every card (falls back to normal rendering)');
assert(dealDelayForIndex(12)===null, 'including the last card');

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
