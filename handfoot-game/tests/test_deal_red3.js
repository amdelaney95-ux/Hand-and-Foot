let ui = { dealAnimation:null, redThreeAnimation:null, lastSeenPhase:null, lastSeenRound:null };
const me = { id:'p0' };
const DEAL_STAGGER_MS = 90, DEAL_POP_MS = 380;

let scheduled = [];
function setTimeout_mock(fn, ms){ scheduled.push({fn, ms}); }
function render(){}
function triggerRedThreeAnimation(cards){ ui.redThreeAnimation = {cards, startedAt: Date.now()}; }

function checkForDealTransition(s){
  if(!s) return;
  const freshDeal = s.phase==='playing' && (ui.lastSeenPhase!=='playing' || ui.lastSeenRound!==s.round);
  if(freshDeal){
    const handSize = (s.hands[me.id]||[]).length || 13;
    const totalMs = handSize*DEAL_STAGGER_MS + DEAL_POP_MS + 250;
    ui.dealAnimation = {startedAt: Date.now(), totalMs, round: s.round};
    setTimeout_mock(()=>{}, totalMs + 100);

    const dealtRedThrees = s.redThrees[me.id] || [];
    if(dealtRedThrees.length > 0){
      const cardsToShow = [...dealtRedThrees];
      setTimeout_mock(()=>{ triggerRedThreeAnimation(cardsToShow); }, totalMs + 150);
    }
  }
  ui.lastSeenPhase = s.phase;
  ui.lastSeenRound = s.round;
}

let failures=0;
function assert(cond,msg){ if(!cond){console.log('FAIL:',msg); failures++;} else {console.log('ok:',msg);} }

// Case 1: fresh deal WITH a red 3 dealt into the initial hand
scheduled = [];
let s = { phase:'playing', round:1, hands:{p0:Array.from({length:13},(_,i)=>({id:'c'+i}))}, redThrees:{p0:[{id:'r3', rank:'3', suit:'♥'}]} };
checkForDealTransition(s);
const expectedTotalMs = 13*DEAL_STAGGER_MS + DEAL_POP_MS + 250;
assert(scheduled.length===2, 'two timers scheduled: the deal-animation cleanup and the red-3 celebration');
const red3Timer = scheduled.find(t=>t.ms === expectedTotalMs+150);
assert(red3Timer !== undefined, `red-3 celebration scheduled to fire AFTER the deal-in stagger finishes (${expectedTotalMs+150}ms)`);
assert(ui.redThreeAnimation === null, 'celebration has NOT fired yet — only scheduled, waiting for the deal-in to finish first');

red3Timer.fn(); // simulate the scheduled time arriving
assert(ui.redThreeAnimation !== null && ui.redThreeAnimation.cards[0].id==='r3', 'once its timer fires, the celebration shows the actual red 3 that was dealt');

// Case 2: fresh deal with NO red 3s -> no celebration scheduled at all
scheduled = []; ui.redThreeAnimation = null; ui.lastSeenPhase=null; ui.lastSeenRound=null;
s = { phase:'playing', round:1, hands:{p0:Array.from({length:13},(_,i)=>({id:'d'+i}))}, redThrees:{p0:[]} };
checkForDealTransition(s);
assert(scheduled.length===1, 'no red 3s dealt -> only the normal deal-animation cleanup timer, nothing extra scheduled');

// Case 3: subsequent renders within the SAME round/phase do not re-trigger (no duplicate scheduling)
scheduled = [];
checkForDealTransition(s); // same s, same round/phase as last call
assert(scheduled.length===0, 'polling again with the same phase/round schedules nothing new (no duplicate deal or celebration)');

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
