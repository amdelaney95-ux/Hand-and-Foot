// Mirrors triggerDrawSequence's decision logic, with mocked timers/state.
let ui = { drawAnimation:null, redThreeAnimation:null };
let netState = null;
let renderCount = 0;
function render(){ renderCount++; }
let scheduledCallbacks = [];
function setTimeout_mock(fn, ms){ scheduledCallbacks.push({fn, ms}); }

const RED3_ANIM_MS = 1500;
const DRAW_ANIM_MS = 1500;

function newlyDrawnCards(beforeIds){
  const hand = netState?.hands['p0'] || [];
  return hand.filter(c=>!beforeIds.has(c.id));
}
function triggerDrawAnimation(cardObjs){
  if(!cardObjs || cardObjs.length===0) return;
  ui.drawAnimation = {cards: cardObjs, startedAt: Date.now()};
}
function triggerRedThreeAnimation(cardObjs, onDone){
  if(!cardObjs || cardObjs.length===0){ if(onDone) onDone(); return; }
  ui.redThreeAnimation = {cards: cardObjs, startedAt: Date.now()};
  render();
  setTimeout_mock(()=>{
    ui.redThreeAnimation = null;
    if(onDone) onDone();
    render();
  }, RED3_ANIM_MS + 60);
}
function triggerDrawSequence(before, redBefore){
  const newRed = (netState?.redThrees['p0']||[]).slice(redBefore);
  const newCards = newlyDrawnCards(before);
  if(newRed.length>0){
    triggerRedThreeAnimation(newRed, ()=>triggerDrawAnimation(newCards));
  } else {
    triggerDrawAnimation(newCards);
  }
}

let failures=0;
function assert(cond,msg){ if(!cond){console.log('FAIL:',msg); failures++;} else {console.log('ok:',msg);} }

// ---- Case 1: normal draw, no red 3 involved -> only the normal popup fires, immediately ----
netState = { hands:{p0:[{id:'a'},{id:'b'}]}, redThrees:{p0:[]} };
let before = new Set(); // empty hand before
let redBefore = 0;
triggerDrawSequence(before, redBefore);
assert(ui.drawAnimation !== null && ui.drawAnimation.cards.length===2, 'no red 3 -> normal draw popup fires immediately with both new cards');
assert(ui.redThreeAnimation === null, 'no red 3 -> no celebration triggered');
assert(scheduledCallbacks.length===0, 'no red 3 -> nothing chained/scheduled');

// ---- Case 2: a red 3 WAS drawn and replaced -> celebration fires now, normal popup is DEFERRED ----
ui.drawAnimation = null; ui.redThreeAnimation = null; scheduledCallbacks = [];
netState = { hands:{p0:[{id:'replacement'}]}, redThrees:{p0:[{id:'r3', rank:'3', suit:'♥'}]} };
before = new Set(); // hand was empty before this draw
redBefore = 0; // no red 3s banked before this action
triggerDrawSequence(before, redBefore);
assert(ui.redThreeAnimation !== null && ui.redThreeAnimation.cards.length===1, 'red 3 involved -> celebration fires immediately');
assert(ui.drawAnimation === null, 'the NORMAL draw popup does NOT fire yet -> confirms back-to-back, not simultaneous');
assert(scheduledCallbacks.length===1 && scheduledCallbacks[0].ms === RED3_ANIM_MS+60, 'the normal popup is correctly scheduled to fire after the celebration ends');

// now simulate that scheduled callback actually firing (celebration duration elapsed)
scheduledCallbacks[0].fn();
assert(ui.redThreeAnimation === null, 'celebration cleared once its timer fires');
assert(ui.drawAnimation !== null && ui.drawAnimation.cards[0].id==='replacement', 'normal popup NOW fires, showing the actual replacement card that landed in hand');

// ---- Case 3: multiple red 3s drawn in one action (rare chain) -> celebration shows all of them together ----
ui.drawAnimation = null; ui.redThreeAnimation = null; scheduledCallbacks = [];
netState = { hands:{p0:[{id:'finalcard'}]}, redThrees:{p0:[{id:'old'},{id:'r3a'},{id:'r3b'}]} };
before = new Set();
redBefore = 1; // 1 red three was already banked before this specific draw action
triggerDrawSequence(before, redBefore);
assert(ui.redThreeAnimation.cards.length===2, 'both newly-triggered red 3s (not the old pre-existing one) are shown together in one celebration');
assert(ui.redThreeAnimation.cards.map(c=>c.id).join(',')==='r3a,r3b', 'correct specific cards identified via the before-count diff');

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
