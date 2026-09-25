// Minimal mock of the client-side globals + extracted logic, to verify the reorder algorithm itself.
const RANK_ORDER = {'3':0,'4':1,'5':2,'6':3,'7':4,'8':5,'9':6,'10':7,'J':8,'Q':9,'K':10,'A':11,'2':12,'JOKER':13};
function sortHand(cards){
  return [...cards].sort((a,b)=> RANK_ORDER[a.rank]-RANK_ORDER[b.rank] || (a.suit||'').localeCompare(b.suit||''));
}
let ui = { handOrder: null, pickedCardId: null };
function getDisplayHand(cards){
  if(!ui.handOrder || ui.handOrder.length===0) return sortHand(cards);
  const byId = new Map(cards.map(c=>[c.id,c]));
  const ordered = [];
  const seen = new Set();
  for(const id of ui.handOrder){
    if(byId.has(id)){ ordered.push(byId.get(id)); seen.add(id); }
  }
  const leftover = cards.filter(c=>!seen.has(c.id));
  return ordered.concat(sortHand(leftover));
}
function pickOrPlaceCard(hand, cardId){
  if(ui.pickedCardId === null){
    ui.pickedCardId = cardId;
  } else if(ui.pickedCardId === cardId){
    ui.pickedCardId = null;
  } else {
    let order = getDisplayHand(hand).map(c=>c.id);
    order = order.filter(id=>id!==ui.pickedCardId);
    const targetIdx = order.indexOf(cardId);
    order.splice(targetIdx, 0, ui.pickedCardId);
    ui.handOrder = order;
    ui.pickedCardId = null;
  }
}
function dropPickedAtEnd(hand){
  if(ui.pickedCardId === null) return;
  let order = getDisplayHand(hand).map(c=>c.id);
  order = order.filter(id=>id!==ui.pickedCardId);
  order.push(ui.pickedCardId);
  ui.handOrder = order;
  ui.pickedCardId = null;
}

let failures=0;
function assert(cond,msg){ if(!cond){console.log('FAIL:',msg); failures++;} else {console.log('ok:',msg);} }

const hand = [
  {id:'a', rank:'7', suit:'♠'}, {id:'b', rank:'K', suit:'♥'}, {id:'c', rank:'3', suit:'♦'}, {id:'d', rank:'Q', suit:'♣'}
];

// default: no custom order -> sorted ascending
let disp = getDisplayHand(hand).map(c=>c.id);
assert(JSON.stringify(disp)===JSON.stringify(['c','a','d','b']), `default sort is ascending by rank (got ${disp})`);

// pick up 'b' (King), place it before 'c' (the 3) -> moves King to the front
pickOrPlaceCard(hand, 'b');
assert(ui.pickedCardId==='b', 'card b picked up');
pickOrPlaceCard(hand, 'c');
disp = getDisplayHand(hand).map(c=>c.id);
assert(JSON.stringify(disp)===JSON.stringify(['b','c','a','d']), `King moved to before the 3 (got ${disp})`);
assert(ui.pickedCardId===null, 'pickup cleared after placing');

// tap the same card again cancels pickup
pickOrPlaceCard(hand, 'a');
pickOrPlaceCard(hand, 'a');
assert(ui.pickedCardId===null, 'tapping the same card twice cancels the pickup, no reorder happens');
disp = getDisplayHand(hand).map(c=>c.id);
assert(JSON.stringify(disp)===JSON.stringify(['b','c','a','d']), 'order unchanged after a cancelled pickup');

// drop at end
pickOrPlaceCard(hand, 'c');
dropPickedAtEnd(hand);
disp = getDisplayHand(hand).map(c=>c.id);
assert(JSON.stringify(disp)===JSON.stringify(['b','a','d','c']), `dropping at end moves the 3 to the last slot (got ${disp})`);

// a newly drawn card (not in custom order) appends in default sorted position among leftovers
const handPlusNew = hand.concat([{id:'e', rank:'4', suit:'♠'}]);
disp = getDisplayHand(handPlusNew).map(c=>c.id);
assert(JSON.stringify(disp)===JSON.stringify(['b','a','d','c','e']), `new card appended after existing custom order (got ${disp})`);

// a melded-away card (removed from hand) just drops out of the custom order
const handMinusOne = hand.filter(c=>c.id!=='a');
disp = getDisplayHand(handMinusOne).map(c=>c.id);
assert(JSON.stringify(disp)===JSON.stringify(['b','d','c']), `removed card drops out cleanly (got ${disp})`);

// sort resets to default
ui.handOrder = null;
disp = getDisplayHand(hand).map(c=>c.id);
assert(JSON.stringify(disp)===JSON.stringify(['c','a','d','b']), 'sorting resets to default ascending order');

console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
