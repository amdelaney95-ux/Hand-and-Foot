let netState = null;
let ui = { drawnThisTurnIds: new Set() };
const me = { id: 'p0' };

function currentHandIds(){
  return new Set((netState?.hands[me.id]||[]).map(c=>c.id));
}
function markNewlyDrawn(beforeIds, {reset=false} = {}){
  if(reset) ui.drawnThisTurnIds = new Set();
  const afterIds = (netState?.hands[me.id]||[]).map(c=>c.id);
  for(const id of afterIds){ if(!beforeIds.has(id)) ui.drawnThisTurnIds.add(id); }
}
function clearNewlyDrawn(){ ui.drawnThisTurnIds = new Set(); }

let failures=0;
function assert(cond,msg){ if(!cond){console.log('FAIL:',msg); failures++;} else {console.log('ok:',msg);} }

// Simulate: hand starts with 2 cards, draw-two-stock adds 2 more
netState = { hands: { p0: [{id:'a'},{id:'b'}] }, turnOrder:['p0'], turnIndex:0 };
let before = currentHandIds();
netState.hands.p0.push({id:'c'},{id:'d'}); // simulate the draw
markNewlyDrawn(before, {reset:true});
assert(ui.drawnThisTurnIds.size===2 && ui.drawnThisTurnIds.has('c') && ui.drawnThisTurnIds.has('d'), 'draw-2-stock marks exactly the 2 new cards');

// Simulate sequential draw: draw 1 from stock (reset+mark), then complete with a 2nd (accumulate, no reset)
netState.hands.p0 = [{id:'a'},{id:'b'}];
before = currentHandIds();
netState.hands.p0.push({id:'e'}); // first card of sequential draw
markNewlyDrawn(before, {reset:true});
assert(ui.drawnThisTurnIds.size===1 && ui.drawnThisTurnIds.has('e'), 'first card of sequential draw marked alone');

before = currentHandIds();
netState.hands.p0.push({id:'f'}); // second card
markNewlyDrawn(before); // no reset -> should accumulate
assert(ui.drawnThisTurnIds.size===2 && ui.drawnThisTurnIds.has('e') && ui.drawnThisTurnIds.has('f'), 'second card ACCUMULATES with the first, not overwrites it');

// Simulate matched pickup: 2 naturals removed (used in meld), pile cards added
netState.hands.p0 = [{id:'a'},{id:'b'},{id:'c'}]; // 'a','b' will be "used" in the mandatory meld
before = currentHandIds();
netState.hands.p0 = [{id:'c'}, {id:'x'},{id:'y'},{id:'z'}]; // a,b removed; x,y,z added from pile
markNewlyDrawn(before, {reset:true});
assert(ui.drawnThisTurnIds.size===3 && ['x','y','z'].every(id=>ui.drawnThisTurnIds.has(id)), 'matched pickup marks only the newly-received pile cards, not the removed naturals');
assert(!ui.drawnThisTurnIds.has('a') && !ui.drawnThisTurnIds.has('b'), 'cards removed from hand for the mandatory meld are never marked as newly drawn');

// Simulate turn ending -> highlight clears
netState.turnIndex = -1; // simulate it no longer being p0's turn (turnOrder[-1] is undefined != 'p0')
function clearDrawnIfTurnEnded(){
  if(netState && netState.turnOrder[netState.turnIndex]!==me.id) clearNewlyDrawn();
}
clearDrawnIfTurnEnded();
assert(ui.drawnThisTurnIds.size===0, 'highlight set clears once the turn moves on to someone else');

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
