/* ---------------------------- Card helpers ---------------------------- */
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS = ['♠','♥','♦','♣'];
const RED_SUITS = ['♥','♦'];
const ROUND_THRESHOLDS = [50,90,120,150];
const RANK_ORDER = {'3':0,'4':1,'5':2,'6':3,'7':4,'8':5,'9':6,'10':7,'J':8,'Q':9,'K':10,'A':11,'2':12,'JOKER':13};
/* Simple original footprint icon for the foot pile — a plain sole + toes shape, not based
   on any particular product's artwork. */
const FOOT_ICON_SVG = `<svg viewBox="0 0 40 60" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="19" cy="39" rx="13" ry="19" fill="var(--brass-bright)"/>
  <circle cx="9" cy="11" r="4.3" fill="var(--brass-bright)"/>
  <circle cx="17" cy="6" r="4.8" fill="var(--brass-bright)"/>
  <circle cx="25" cy="7" r="4.3" fill="var(--brass-bright)"/>
  <circle cx="32" cy="11" r="3.8" fill="var(--brass-bright)"/>
  <circle cx="37" cy="17" r="3.1" fill="var(--brass-bright)"/>
</svg>`;

function isWild(c){ return c.rank==='2' || c.rank==='JOKER'; }
function isRedThree(c){ return c.rank==='3' && RED_SUITS.includes(c.suit); }
function isBlackThree(c){ return c.rank==='3' && c.suit && !RED_SUITS.includes(c.suit); }
function cardPointValue(c){
  if(c.rank==='JOKER') return 50;
  if(c.rank==='A' || c.rank==='2') return 20;
  if(['8','9','10','J','Q','K'].includes(c.rank)) return 10;
  return 5;
}
function cardLabel(c){ return c.rank==='JOKER' ? 'JKR' : (c.rank + (c.suit||'')); }
function cardColorClass(c){
  if(c.rank==='JOKER') return 'wild';
  if(c.rank==='2') return 'wild';
  if(RED_SUITS.includes(c.suit)) return 'red';
  return '';
}
function esc(s){ return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function buildDeck(numDecks){
  let cards = []; let n=0;
  for(let d=0; d<numDecks; d++){
    for(const s of SUITS){ for(const r of RANKS){ cards.push({id:'c'+(n++), rank:r, suit:s}); } }
    cards.push({id:'c'+(n++), rank:'JOKER', suit:null});
    cards.push({id:'c'+(n++), rank:'JOKER', suit:null});
  }
  return cards;
}
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr;
}
function sortHand(cards){
  return [...cards].sort((a,b)=> RANK_ORDER[a.rank]-RANK_ORDER[b.rank] || (a.suit||'').localeCompare(b.suit||''));
}
/* Applies the player's custom drag order on top of their current hand, if one is set.
   New cards (drawn/picked up) not yet in the custom order are appended in default sorted
   position; cards no longer in hand (melded/discarded) just drop out. Purely a client-side
   display concern — never touches shared state. */
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
/* Canonical ascending order for meld groups (by rank), used as the shared default for
   everyone's melds boards — deterministic and rank-based, so every viewer computes the
   same order independently with no sync needed. Wild-canasta groups sort last. */
function meldSortValue(rank){ return rank==='WILD' ? 99 : (RANK_ORDER[rank] ?? 50); }
function sortMelds(melds){ return [...melds].sort((a,b)=>meldSortValue(a.rank)-meldSortValue(b.rank)); }
/* Personal override on top of the ascending default, for the viewer's OWN melds board
   only (mirrors getDisplayHand) — never affects how others see this player's melds. */
function getDisplayMelds(melds){
  if(!ui.meldOrder || ui.meldOrder.length===0) return sortMelds(melds);
  const byRank = new Map(melds.map(m=>[m.rank,m]));
  const ordered = [];
  const seen = new Set();
  for(const r of ui.meldOrder){
    if(byRank.has(r)){ ordered.push(byRank.get(r)); seen.add(r); }
  }
  const leftover = melds.filter(m=>!seen.has(m.rank));
  return ordered.concat(sortMelds(leftover));
}
function genRoomCode(){
  const letters='ABCDEFGHJKLMNPQRSTUVWXYZ'; let s='';
  for(let i=0;i<4;i++) s+=letters[Math.floor(Math.random()*letters.length)];
  return s;
}
function genPlayerId(){ return 'p'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }

/* ---------------------------- Game engine ------------------------------ */
function nameOf(state,pid){ const p=state.players.find(x=>x.id===pid); return p?p.name:'Someone'; }
function log(state,msg){ state.log=state.log||[]; state.log.push(msg); if(state.log.length>40) state.log=state.log.slice(-40); }

function newRoomState(code, hostId, hostName){
  return {
    code, hostId, phase:'lobby',
    players:[{id:hostId, name:hostName}],
    round:1, threshold:ROUND_THRESHOLDS[0],
    turnOrder:[], turnIndex:0, turnPhase:'draw', turnHasDrawn:false,
    drawPile:[], discardPile:[],
    hands:{}, feet:{}, footOpen:{}, melds:{}, redThrees:{}, initialMeldMet:{},
    scores:{}, wentOutPlayer:null, roundBreakdowns:{},
    log:['Room created.'], rev:1, updatedAt: Date.now()
  };
}

function drawFromStock(state){
  if(state.drawPile.length===0){
    if(state.discardPile.length<=1) return null;
    const top = state.discardPile.pop();
    state.drawPile = shuffle(state.discardPile);
    state.discardPile = [top];
    log(state,'The stock ran dry — reshuffling the discard pile into a new stock.');
  }
  return state.drawPile.pop();
}

function resolveRedThrees(state, pid, hand){
  let found=true;
  while(found){
    found=false;
    for(let i=hand.length-1;i>=0;i--){
      if(isRedThree(hand[i])){
        const [rt]=hand.splice(i,1);
        state.redThrees[pid]=state.redThrees[pid]||[];
        state.redThrees[pid].push(rt);
        log(state, `♥ ${nameOf(state,pid)} drew a red 3 — +100 banked! (${state.redThrees[pid].length} so far)`);
        const repl=drawFromStock(state);
        if(repl) hand.push(repl);
        found=true; break;
      }
    }
  }
}

function dealGame(state){
  const numDecks = state.turnOrder.length + 1;
  state.drawPile = shuffle(buildDeck(numDecks));
  state.hands={}; state.feet={}; state.footOpen={}; state.melds={}; state.redThrees={}; state.initialMeldMet={};
  for(const pid of state.turnOrder){
    state.hands[pid] = state.drawPile.splice(state.drawPile.length-13,13);
    state.feet[pid]  = state.drawPile.splice(state.drawPile.length-13,13);
    state.footOpen[pid]=false; state.melds[pid]=[]; state.redThrees[pid]=[]; state.initialMeldMet[pid]=false;
    resolveRedThrees(state, pid, state.hands[pid]);
  }
  state.discardPile=[];
  let guard=0, flipped=null;
  while(guard++<1000){
    const c = state.drawPile.pop();
    if(!c) break;
    if(isRedThree(c)){ state.drawPile.push(c); state.drawPile=shuffle(state.drawPile); continue; }
    flipped=c; break;
  }
  if(flipped) state.discardPile.push(flipped);
  state.turnIndex=0; state.turnPhase='draw'; state.turnHasDrawn=false; state.pendingSecondDraw=false; state.pendingSecondDrawSource=null;
  state.turnStartedAt = Date.now();
  state.threshold = ROUND_THRESHOLDS[state.round-1];
  state.wentOutPlayer=null;
  log(state, `Hand ${state.round} dealt — lay-down minimum is ${state.threshold} points.`);
}

function topDiscard(state){ return state.discardPile.length? state.discardPile[state.discardPile.length-1] : null; }
function pileFrozen(state){ const t=topDiscard(state); return !!(t && isBlackThree(t)); }

function validateMeldGroup(cards){
  if(cards.some(isBlackThree)) return {ok:false, reason:'Black 3s can never be melded — discard only.'};
  if(cards.some(isRedThree)) return {ok:false, reason:'Red 3s play automatically and cannot be melded by hand.'};
  const naturals = cards.filter(c=>!isWild(c));
  const wilds = cards.filter(isWild);
  if(naturals.length===0){
    if(wilds.length===0) return {ok:false, reason:'Select at least one card.'};
    return {ok:true, rank:'WILD'}; // all 2s/Jokers — its own wild-canasta meld
  }
  const rank = naturals[0].rank;
  if(!naturals.every(c=>c.rank===rank)) return {ok:false, reason:'All natural cards in a meld must share the same rank.'};
  if(wilds.length>0 && wilds.length>=naturals.length) return {ok:false, reason:'A meld needs more natural cards than wild cards.'};
  return {ok:true, rank};
}

function applyMeldToBoard(state, pid, cards, forcedRank){
  const allWild = cards.every(isWild);
  const rank = forcedRank || (allWild ? 'WILD' : cards.find(c=>!isWild(c)).rank);
  let meld = state.melds[pid].find(m=>m.rank===rank);
  if(!meld){ meld={rank, cards:[]}; state.melds[pid].push(meld); }
  meld.cards.push(...cards);
  if(meld.rank==='WILD'){
    meld.type = 'clean'; // house rule: a full wild canasta counts as clean
  } else {
    const wildCount = meld.cards.filter(isWild).length;
    meld.type = wildCount>0 ? 'dirty' : 'clean';
  }
  meld.isCanasta = meld.cards.length>=7;
}

function canastaReqsMet(state,pid){
  const c = state.melds[pid].filter(m=>m.isCanasta);
  return c.some(x=>x.type==='clean') && c.some(x=>x.type==='dirty');
}
/* "Floating": played all the way through hand and foot but hasn't met the clean+dirty
   canasta requirement yet — sitting on 0 cards until their next draw. Purely derived from
   existing state, nothing new to track. */
function isFloating(state,pid){
  return (state.hands[pid]||[]).length===0 && !!state.footOpen[pid] && !canastaReqsMet(state,pid);
}

/* eligible existing (non-wild) melds a loose group of `wildCount` wild cards could be redirected into.
   No size cap — a completed canasta can still take overflow cards, it just won't earn a second bonus. */
function eligibleWildTargets(state, pid, wildCount){
  return (state.melds[pid]||[]).filter(m=>{
    if(m.rank==='WILD') return false;
    const naturalCount = m.cards.filter(c=>!isWild(c)).length;
    const existingWildCount = m.cards.length - naturalCount;
    return naturalCount > (existingWildCount + wildCount);
  });
}

function tryAddMeldGroup(state, pid, cardIds, targetRank){
  const hand = state.hands[pid];
  const cards = cardIds.map(id=>hand.find(c=>c.id===id)).filter(Boolean);
  if(cards.length!==cardIds.length) return {ok:false, reason:'Card not found in hand.'};
  const v = validateMeldGroup(cards);
  if(!v.ok) return v;

  // Redirect: an all-wild group can be aimed at an existing natural-rank meld instead of the wild canasta.
  if(v.rank==='WILD' && targetRank && targetRank!=='WILD'){
    const existing = state.melds[pid].find(m=>m.rank===targetRank);
    if(!existing) return {ok:false, reason:`No open ${targetRank} meld to add these wilds to.`};
    const combined = existing.cards.concat(cards);
    const combinedWildCount = combined.filter(isWild).length;
    const combinedNaturalCount = combined.length - combinedWildCount;
    if(combinedWildCount >= combinedNaturalCount) return {ok:false, reason:'That would leave the meld with too many wilds (needs more naturals than wilds).'};
    return {ok:true, cards, rank:targetRank};
  }

  const existing = state.melds[pid].find(m=>m.rank===v.rank);
  if(!existing && cards.length<3) return {ok:false, reason:'A brand-new meld needs at least 3 cards.'};
  if(existing){
    const combined = existing.cards.concat(cards);
    const cv = validateMeldGroup(combined);
    if(!cv.ok) return cv;
  }
  return {ok:true, cards, rank:v.rank};
}

function meldActionLabel(rank){ return rank==='WILD' ? 'Wild' : rank; }
function describeMeldAction(existedBefore, rank, count){
  const label = meldActionLabel(rank);
  return existedBefore
    ? `added ${count} card${count===1?'':'s'} to their ${label} meld`
    : `started a new ${label} meld`;
}
function commitMeldGroupsNow(state, pid, groups){
  const descriptions = [];
  for(const g of groups){
    const ids = Array.isArray(g) ? g : g.ids;
    const targetRank = Array.isArray(g) ? undefined : g.targetRank;
    const r = tryAddMeldGroup(state, pid, ids, targetRank);
    if(!r.ok) return r;
    const existedBefore = state.melds[pid].some(m=>m.rank===r.rank);
    const hand = state.hands[pid];
    for(const c of r.cards){ const idx=hand.findIndex(x=>x.id===c.id); hand.splice(idx,1); }
    applyMeldToBoard(state, pid, r.cards, r.rank);
    descriptions.push(describeMeldAction(existedBefore, r.rank, r.cards.length));
  }
  log(state, `${nameOf(state,pid)} ${descriptions.join('; ')}.`);
  checkEmptyHandDuringMeld(state, pid);
  return {ok:true};
}

function confirmInitialMelds(state, pid, groupsOfCardIds){
  const hand = state.hands[pid];
  let total=0; const resolved=[];
  for(const cardIds of groupsOfCardIds){
    const cards = cardIds.map(id=>hand.find(c=>c.id===id)).filter(Boolean);
    if(cards.length!==cardIds.length) return {ok:false, reason:'Card not found.'};
    const v = validateMeldGroup(cards);
    if(!v.ok) return v;
    if(cards.length<3) return {ok:false, reason:'Each new meld needs at least 3 cards for your initial meld.'};
    total += cards.reduce((s,c)=>s+cardPointValue(c),0);
    resolved.push(cards);
  }
  if(total < state.threshold) return {ok:false, reason:`Only ${total} of ${state.threshold} points staged — add more or cancel.`};
  for(const cards of resolved){
    for(const c of cards){ const idx=hand.findIndex(x=>x.id===c.id); hand.splice(idx,1); }
    applyMeldToBoard(state, pid, cards);
  }
  state.initialMeldMet[pid]=true;
  log(state, `${nameOf(state,pid)} laid their initial meld (${total} pts).`);
  checkEmptyHandDuringMeld(state, pid);
  return {ok:true};
}

function drawTwoStock(state, pid){
  const hand = state.hands[pid];
  for(let i=0;i<2;i++){ const c=drawFromStock(state); if(c) hand.push(c); }
  resolveRedThrees(state, pid, hand);
  state.turnPhase='meld'; state.turnHasDrawn=true;
  log(state, `${nameOf(state,pid)} drew 2 from the stock.`);
  return {ok:true};
}
function drawDiscardPlusStock(state, pid){
  if(pileFrozen(state)) return {ok:false, reason:'The pile is frozen by a black 3.'};
  if(!topDiscard(state)) return {ok:false, reason:'Discard pile is empty.'};
  const hand = state.hands[pid];
  hand.push(state.discardPile.pop());
  const c = drawFromStock(state); if(c) hand.push(c);
  resolveRedThrees(state, pid, hand);
  state.turnPhase='meld'; state.turnHasDrawn=true;
  log(state, `${nameOf(state,pid)} took the top discard + 1 from stock.`);
  return {ok:true};
}

/* Sequential single-card draw: draw 1 (from stock OR discard), see it, then draw the 2nd card. */
function drawOneStockFirst(state, pid){
  if(state.turnHasDrawn) return {ok:false, reason:'Already drew this turn.'};
  if(state.pendingSecondDraw) return {ok:false, reason:'Finish choosing your second card first.'};
  const hand = state.hands[pid];
  const c = drawFromStock(state); if(c) hand.push(c);
  resolveRedThrees(state, pid, hand);
  state.pendingSecondDraw = true;
  state.pendingSecondDrawSource = 'stock';
  log(state, `${nameOf(state,pid)} drew 1 from the stock and is choosing their second card.`);
  return {ok:true};
}
function drawDiscardFirst(state, pid){
  if(state.turnHasDrawn) return {ok:false, reason:'Already drew this turn.'};
  if(state.pendingSecondDraw) return {ok:false, reason:'Finish drawing your second card first.'};
  if(pileFrozen(state)) return {ok:false, reason:'The pile is frozen by a black 3.'};
  if(!topDiscard(state)) return {ok:false, reason:'Discard pile is empty.'};
  const hand = state.hands[pid];
  hand.push(state.discardPile.pop());
  resolveRedThrees(state, pid, hand);
  state.pendingSecondDraw = true;
  state.pendingSecondDrawSource = 'discard';
  log(state, `${nameOf(state,pid)} took the top discard and still needs to draw from the stock.`);
  return {ok:true};
}
function completeDrawSecondStock(state, pid){
  if(!state.pendingSecondDraw) return {ok:false, reason:'No draw in progress.'};
  const hand = state.hands[pid];
  const c = drawFromStock(state); if(c) hand.push(c);
  resolveRedThrees(state, pid, hand);
  state.pendingSecondDraw = false; state.pendingSecondDrawSource = null;
  state.turnPhase='meld'; state.turnHasDrawn=true;
  log(state, `${nameOf(state,pid)} drew a second card from the stock.`);
  return {ok:true};
}
function completeDrawSecondDiscard(state, pid){
  if(!state.pendingSecondDraw) return {ok:false, reason:'No draw in progress.'};
  if(state.pendingSecondDrawSource==='discard') return {ok:false, reason:'You already took the discard card — draw your second card from the stock.'};
  if(pileFrozen(state)) return {ok:false, reason:'The pile is frozen by a black 3.'};
  if(!topDiscard(state)) return {ok:false, reason:'Discard pile is empty.'};
  const hand = state.hands[pid];
  hand.push(state.discardPile.pop());
  resolveRedThrees(state, pid, hand);
  state.pendingSecondDraw = false; state.pendingSecondDrawSource = null;
  state.turnPhase='meld'; state.turnHasDrawn=true;
  log(state, `${nameOf(state,pid)} took the top discard as their second card.`);
  return {ok:true};
}

function matchedPickupCommit(state, pid, natCardIds, extraGroups){
  const hand = state.hands[pid];
  const top = topDiscard(state);
  if(!top) return {ok:false, reason:'No discard to match.'};
  if(isBlackThree(top)) return {ok:false, reason:'The pile is frozen by a black 3.'};
  const naturals = natCardIds.map(id=>hand.find(c=>c.id===id)).filter(Boolean);
  if(naturals.length!==2) return {ok:false, reason:'Pick exactly 2 matching cards.'};
  if(naturals.some(c=>isWild(c)||isBlackThree(c)||isRedThree(c))) return {ok:false, reason:'Must be 2 natural (non-wild) cards.'};
  if(!naturals.every(c=>c.rank===top.rank)) return {ok:false, reason:'Selected cards must match the discard rank.'};
  const mandatory = [...naturals, top];
  const mv = validateMeldGroup(mandatory);
  if(!mv.ok) return mv;

  let total = mandatory.reduce((s,c)=>s+cardPointValue(c),0);
  const resolvedExtra=[]; // {cards, rank}
  for(const grp of extraGroups){
    const ids = Array.isArray(grp) ? grp : grp.ids;
    const targetRank = Array.isArray(grp) ? undefined : grp.targetRank;
    const r = tryAddMeldGroup(state, pid, ids, targetRank);
    if(!r.ok) return r;
    total += r.cards.reduce((s,c)=>s+cardPointValue(c),0);
    resolvedExtra.push(r);
  }
  if(!state.initialMeldMet[pid] && total < state.threshold){
    return {ok:false, reason:`Not enough for your initial meld yet (${total}/${state.threshold}). Add more melds or cancel the pickup.`};
  }

  const totalPileSize = state.discardPile.length; // includes the top card, before anything is removed
  const totalTake = Math.min(7, totalPileSize); // cards leaving the discard pile overall, capped at 7 — top card counts toward this cap
  const additionalTake = totalTake - 1; // beyond the top card, which is already spoken for by the mandatory meld

  const mandatoryExistedBefore = state.melds[pid].some(m=>m.rank===mv.rank);
  const extraExistedBefore = resolvedExtra.map(r=>state.melds[pid].some(m=>m.rank===r.rank));

  for(const c of naturals){ const idx=hand.findIndex(x=>x.id===c.id); hand.splice(idx,1); }
  state.discardPile.pop();
  applyMeldToBoard(state, pid, mandatory);
  for(const r of resolvedExtra){
    for(const c of r.cards){ const idx=hand.findIndex(x=>x.id===c.id); hand.splice(idx,1); }
    applyMeldToBoard(state, pid, r.cards, r.rank);
  }
  if(!state.initialMeldMet[pid]) state.initialMeldMet[pid]=true;

  const taken = state.discardPile.splice(state.discardPile.length-additionalTake, additionalTake);
  hand.push(...taken);
  resolveRedThrees(state, pid, hand);
  const take = totalTake;

  state.turnPhase='meld'; state.turnHasDrawn=true;
  const meldDescriptions = [describeMeldAction(mandatoryExistedBefore, mv.rank, mandatory.length)];
  resolvedExtra.forEach((r,i)=>{ meldDescriptions.push(describeMeldAction(extraExistedBefore[i], r.rank, r.cards.length)); });
  log(state, `${nameOf(state,pid)} matched the pile (picked up ${take} card${take===1?'':'s'}) and ${meldDescriptions.join('; ')}.`);
  checkEmptyHandDuringMeld(state, pid);
  return {ok:true};
}

function openFootFor(state, pid){
  state.hands[pid] = state.feet[pid];
  state.feet[pid] = [];
  state.footOpen[pid] = true;
  resolveRedThrees(state, pid, state.hands[pid]);
}

function afterHandChange(state, pid){
  const hand = state.hands[pid];
  if(hand.length===0){
    if(!state.footOpen[pid]){
      openFootFor(state, pid);
      log(state, `${nameOf(state,pid)} emptied their hand and picked up their foot (${state.hands[pid].length} cards)!`);
      return 'foot-opened';
    } else {
      if(canastaReqsMet(state,pid)) return 'went-out';
      return 'empty-no-out';
    }
  }
  return 'has-cards';
}

/* Called right after a meld commit (not a discard). Melding your whole hand away should let you
   keep playing off the foot the same turn — only discarding ends a turn. */
function checkEmptyHandDuringMeld(state, pid){
  const hand = state.hands[pid];
  if(hand.length>0) return 'has-cards';
  if(!state.footOpen[pid]){
    openFootFor(state, pid);
    log(state, `${nameOf(state,pid)} melded their whole hand and jumped straight into their foot (${state.hands[pid].length} cards) — turn continues!`);
    return 'foot-opened';
  }
  if(canastaReqsMet(state,pid)){
    scoreRoundEnd(state, pid);
    log(state, `${nameOf(state,pid)} melded through hand and foot without discarding and went out!`);
    return 'went-out';
  }
  log(state, `${nameOf(state,pid)} has nothing left to play and is floating — turn ends automatically.`);
  advanceTurn(state);
  return 'empty-no-out';
}

function scoreRoundEnd(state, outPid){
  state.roundBreakdowns = state.roundBreakdowns || {};
  const breakdown = {};
  for(const pid of state.turnOrder){
    let meldValue=0, canastaBonus=0;
    for(const m of state.melds[pid]){
      meldValue += m.cards.reduce((s,c)=>s+cardPointValue(c),0);
      if(m.isCanasta){
        if(m.rank==='WILD') canastaBonus += 1500;
        else canastaBonus += (m.type==='clean'?300:100);
      }
    }
    const redThreeCount = state.redThrees[pid]?.length||0;
    const redThreeBonus = redThreeCount*100;
    const handPenalty = state.hands[pid].reduce((s,c)=>s+cardPointValue(c),0);
    const footPenalty = state.feet[pid].reduce((s,c)=>s+cardPointValue(c),0);
    const total = meldValue + canastaBonus + redThreeBonus - handPenalty - footPenalty;
    breakdown[pid] = {meldValue, canastaBonus, redThreeCount, redThreeBonus, handPenalty, footPenalty, total};
    state.scores[pid] = state.scores[pid] || [null,null,null,null];
    state.scores[pid][state.round-1] = total;
  }
  state.roundBreakdowns[state.round] = breakdown;
  state.wentOutPlayer = outPid;
  state.phase='roundEnd';
  log(state, `${nameOf(state,outPid)} went out! Hand ${state.round} is scored.`);
}

function advanceTurn(state){
  state.turnIndex = (state.turnIndex+1) % state.turnOrder.length;
  state.turnPhase='draw'; state.turnHasDrawn=false; state.pendingSecondDraw=false; state.pendingSecondDrawSource=null;
  state.turnStartedAt = Date.now();
}

function performDiscard(state, pid, cardId){
  const hand = state.hands[pid];
  const idx = hand.findIndex(c=>c.id===cardId);
  if(idx===-1) return {ok:false, reason:'Card not in hand.'};
  const [card] = hand.splice(idx,1);
  state.discardPile.push(card);
  log(state, `${nameOf(state,pid)} discarded ${cardLabel(card)}.`);
  const status = afterHandChange(state, pid);
  if(status==='went-out'){ scoreRoundEnd(state, pid); }
  else { advanceTurn(state); }
  return {ok:true};
}

function afterMeldCheckAndAdvance(state, pid){
  const hand = state.hands[pid];
  if(hand.length===0){
    // Emptying via melding is already handled by checkEmptyHandDuringMeld at commit time
    // (foot opened & turn continued, went out, or genuinely nothing left) — if we land here
    // with 0 cards, there's nothing left to meld or discard, so the turn just ends.
    advanceTurn(state);
    return 'empty-no-out';
  }
  state.turnPhase='discard';
  return 'has-cards';
}

/* Reverses ONLY the meld->discard phase flip, and only while nothing else has happened yet.
   Safe by construction: reaching discard phase as the active player guarantees no discard
   has occurred and the hand is untouched (the only other path out of meld phase — emptying
   the hand — ends the turn immediately instead of entering discard phase at all). This never
   needs to unwind any card movement, so there's nothing else to restore. */
function undoToMeldPhase(state, pid){
  if(state.turnOrder[state.turnIndex] !== pid) return {ok:false, reason:'Not your turn.'};
  if(state.turnPhase !== 'discard') return {ok:false, reason:'Nothing to undo right now.'};
  state.turnPhase = 'meld';
  log(state, `${nameOf(state,pid)} went back to melding.`);
  return {ok:true};
}

function goToNextHandOrEnd(state){
  if(state.round>=4){ state.phase='gameOver'; log(state,'The last hand is complete — game over!'); return; }
  state.round += 1;
  state.turnOrder.push(state.turnOrder.shift());
  dealGame(state);
  state.phase='playing';
}

function resetToLobby(state){
  state.phase='lobby'; state.round=1; state.threshold=ROUND_THRESHOLDS[0];
  state.turnOrder=[]; state.turnIndex=0; state.turnPhase='draw'; state.turnHasDrawn=false; state.pendingSecondDraw=false; state.pendingSecondDrawSource=null;
  state.drawPile=[]; state.discardPile=[];
  state.hands={}; state.feet={}; state.footOpen={}; state.melds={}; state.redThrees={}; state.initialMeldMet={};
  state.scores={}; state.wentOutPlayer=null; state.roundBreakdowns={};
  log(state,'Back to the lobby for a new game.');
}

