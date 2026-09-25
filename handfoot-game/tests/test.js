const fs = require('fs');
eval(fs.readFileSync('engine.js','utf8'));

function totalCardsInState(state){
  let n = state.drawPile.length + state.discardPile.length;
  for(const pid of state.turnOrder){
    n += (state.hands[pid]||[]).length;
    n += (state.feet[pid]||[]).length;
    n += (state.redThrees[pid]||[]).length;
    for(const m of (state.melds[pid]||[])) n += m.cards.length;
  }
  return n;
}

function makeState(numPlayers){
  const players = [];
  for(let i=0;i<numPlayers;i++) players.push({id:'p'+i, name:'Player'+i});
  const state = newRoomState('TEST', 'p0', 'Player0');
  state.players = players;
  state.turnOrder = players.map(p=>p.id);
  return state;
}

function greedyMeldGroups(hand, existingMelds){
  // group by rank among naturals only (skip wilds/black3/red3 handled elsewhere)
  const byRank = {};
  for(const c of hand){
    if(isWild(c) || isBlackThree(c) || isRedThree(c)) continue;
    byRank[c.rank] = byRank[c.rank]||[];
    byRank[c.rank].push(c.id);
  }
  const groups = [];
  for(const rank in byRank){
    const ids = byRank[rank];
    const hasExisting = existingMelds.some(m=>m.rank===rank && m.cards.length<7);
    if(ids.length>=3 || hasExisting){
      groups.push(ids);
    }
  }
  return groups;
}

function simulate(numPlayers, maxTurns){
  const state = makeState(numPlayers);
  dealGame(state);
  const numDecks = numPlayers+1;
  const expectedTotal = numDecks*54;

  let turns=0;
  let roundsCompleted=0;
  while(turns++ < maxTurns){
    if(state.phase==='gameOver'){ break; }
    if(state.phase==='roundEnd'){
      roundsCompleted++;
      goToNextHandOrEnd(state);
      continue;
    }
    const pid = state.turnOrder[state.turnIndex];
    const hand = state.hands[pid];

    if(state.turnPhase==='draw'){
      const top = topDiscard(state);
      if(top && !isBlackThree(top)){
        const r = drawDiscardPlusStock(state, pid);
        if(!r.ok) throw new Error('draw fail: '+r.reason);
      } else {
        const r = drawTwoStock(state, pid);
        if(!r.ok) throw new Error('draw fail: '+r.reason);
      }
    } else if(state.turnPhase==='meld'){
      const groups = greedyMeldGroups(hand, state.melds[pid]);
      if(groups.length>0){
        if(!state.initialMeldMet[pid]){
          const r = confirmInitialMelds(state, pid, groups);
          // it's fine if it fails (not enough points) -- just move on to discard
        } else {
          const r = commitMeldGroupsNow(state, pid, groups);
        }
      }
      const status = afterMeldCheckAndAdvance(state, pid);
      // loop continues; if status left us in 'discard' phase, next iteration handles it
    } else if(state.turnPhase==='discard'){
      const h = state.hands[pid];
      if(h.length===0){
        advanceTurn(state);
      } else {
        // discard a card not in melds obviously (it's just from hand), pick last one
        const cid = h[h.length-1].id;
        const r = performDiscard(state, pid, cid);
        if(!r.ok) throw new Error('discard fail: '+r.reason);
      }
    }

    const total = totalCardsInState(state);
    if(total !== expectedTotal){
      throw new Error(`Card conservation broken at turn ${turns}: expected ${expectedTotal}, got ${total}`);
    }
  }
  return {turns, roundsCompleted, finalPhase: state.phase, round: state.round, scores: state.scores};
}

for(const n of [2,3,4,6]){
  try{
    const res = simulate(n, 4000);
    console.log(`players=${n} ->`, JSON.stringify(res));
  } catch(e){
    console.log(`players=${n} -> ERROR:`, e.message);
  }
}
