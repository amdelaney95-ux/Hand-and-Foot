// jsdom isn't available in this sandbox (no network access to install it), so this hand-rolled
// mock replicates just the specific DOM behavior this fix depends on: assigning innerHTML
// destroys old child nodes and creates brand-new ones (scrollTop always starts at 0 on a
// freshly-created element) — that destroy/recreate semantic is exactly what causes the bug,
// and exactly what the capture-before/restore-after fix has to work around.

let elements;
function mockSetAppInnerHTML(hasLogBox){
  elements = {}; // old DOM nodes are gone — a real browser does the same on innerHTML assignment
  if(hasLogBox){
    elements['logBox'] = { scrollTop: 0 }; // brand-new node, always starts at 0
  }
}
const mockDocument = { getElementById(id){ return elements[id] || null; } };

// The OLD (buggy) render logic — no capture/restore at all.
function renderOldBuggy(){
  mockSetAppInnerHTML(true);
}

// The NEW (fixed) render logic — mirrors exactly what's now in the actual file.
function renderFixed(){
  const prevLogBox = mockDocument.getElementById('logBox');
  const prevScrollTop = prevLogBox ? prevLogBox.scrollTop : 0;
  mockSetAppInnerHTML(true);
  const newLogBox = mockDocument.getElementById('logBox');
  if(newLogBox) newLogBox.scrollTop = prevScrollTop;
}

let failures=0;
function assert(cond,msg){ if(!cond){console.log('FAIL:',msg); failures++;} else {console.log('ok:',msg);} }

// ---- Demonstrate the bug exists in the old approach (sanity check on the mock itself) ----
mockSetAppInnerHTML(true);
elements['logBox'].scrollTop = 80; // user scrolled down into log history
renderOldBuggy(); // simulates a poll/timer-tick re-render with no preservation logic
assert(mockDocument.getElementById('logBox').scrollTop === 0, 'confirms the bug: old approach resets scroll to 0 on every re-render');

// ---- Fixed approach preserves scroll position across a re-render ----
mockSetAppInnerHTML(true);
elements['logBox'].scrollTop = 80;
renderFixed();
assert(mockDocument.getElementById('logBox').scrollTop === 80, 'fixed approach restores the scroll position after the DOM rebuild');

// ---- Preserved across MULTIPLE consecutive renders (simulating repeated timer ticks/polls) ----
for(let i=0;i<5;i++){ renderFixed(); }
assert(mockDocument.getElementById('logBox').scrollTop === 80, 'position holds steady across several repeated re-renders, not just one');

// ---- A user actually at the top (scrollTop 0) stays at the top, unaffected ----
mockSetAppInnerHTML(true);
elements['logBox'].scrollTop = 0;
renderFixed();
assert(mockDocument.getElementById('logBox').scrollTop === 0, 'a user already at the top stays at the top (unchanged default behavior)');

// ---- Graceful if the log box doesn't exist yet (e.g. lobby screen, no crash) ----
mockSetAppInnerHTML(false); // no logBox this "screen"
let threw = false;
try{
  const prevLogBox = mockDocument.getElementById('logBox');
  const prevScrollTop = prevLogBox ? prevLogBox.scrollTop : 0;
  mockSetAppInnerHTML(false);
  const newLogBox = mockDocument.getElementById('logBox');
  if(newLogBox) newLogBox.scrollTop = prevScrollTop;
}catch(e){ threw = true; }
assert(!threw, 'no crash when the log box is absent from the DOM (e.g. lobby/landing screens)');

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
