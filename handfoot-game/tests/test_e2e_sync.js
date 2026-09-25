/* End-to-end sync test. Loads the REAL handfoot.html into jsdom as several simulated devices and
   drives the actual buttons. Covers both backends:

   - Firebase, against an in-memory fake that reproduces the Realtime Database behaviors this code
     relies on: transactions whose first run gets null when the client hasn't cached the room,
     compare-and-set commits that re-run the update function on conflict, undefined = abort, and
     value listeners pushed to every connected client.
   - Claude storage, against a fake window.storage that (like the real one) throws on missing keys.

   Needs jsdom:  cd tests && npm install      (prints SKIPPED and exits cleanly if it's missing)  */

let JSDOM, VirtualConsole;
try{ ({JSDOM, VirtualConsole} = require('jsdom')); }
catch(e){ console.log('SKIPPED: jsdom not installed. Run `cd tests && npm install` to enable the end-to-end sync test.'); process.exit(0); }

const fs = require('fs');
const path = require('path');
const BASE_HTML = fs.readFileSync(path.join(__dirname, '..', 'handfoot.html'), 'utf8');

let failures = 0;
function assert(cond, msg){ if(!cond){ console.log('FAIL:', msg); failures++; } else { console.log('ok:', msg); } }
const sleep = ms => new Promise(r=>setTimeout(r, ms));
const clone = v => v===undefined ? undefined : JSON.parse(JSON.stringify(v));
async function waitFor(fn, what, ms=6000){
  const t0 = Date.now();
  while(Date.now()-t0 < ms){ try{ if(fn()) return; }catch(e){} await sleep(15); }
  throw new Error('timed out waiting for: '+what);
}

/* ------------------------------ fake Firebase ------------------------------ */
function createFakeFirebaseServer(){
  const data = {};              // path -> stored value
  const listeners = [];         // {client, path, cb}
  const stats = {transactionRuns:0, conflicts:0};
  const snap = v => ({ exists: ()=>v!==undefined && v!==null, val: ()=>clone(v) });
  function notify(p){
    for(const l of listeners.filter(l=>l.path===p)){
      const v = clone(data[p]);
      setTimeout(()=>l.cb(snap(v)), 0);
    }
  }
  function modulesFor(clientName){
    const isListening = p => listeners.some(l=>l.client===clientName && l.path===p);
    const app = { initializeApp: cfg => ({cfg}) };
    const auth = { getAuth: ()=>({}), signInAnonymously: async ()=>{ await sleep(2); return {user:{uid:clientName}}; } };
    const db = {
      getDatabase: ()=>({}),
      ref: (_db, p)=>({path:p}),
      get: async r => { await sleep(1+Math.random()*4); return snap(data[r.path]); },
      onValue(r, cb){
        const l = {client:clientName, path:r.path, cb};
        listeners.push(l);
        const v = clone(data[r.path]);
        setTimeout(()=>cb(snap(v)), 0);
        return ()=>{ const i = listeners.indexOf(l); if(i>=0) listeners.splice(i,1); };
      },
      async runTransaction(r, fn){
        // Real RTDB: the first run sees the local cache, which is null unless this client
        // is already listening to the path — even if the data exists on the server.
        let local = isListening(r.path) ? clone(data[r.path] ?? null) : null;
        for(let attempt=0; attempt<25; attempt++){
          stats.transactionRuns++;
          const proposed = fn(clone(local));
          if(proposed===undefined) return {committed:false, snapshot:snap(data[r.path])};
          await sleep(Math.random()*6);   // network latency: lets concurrent writers interleave
          const serverNow = data[r.path] ?? null;
          if(JSON.stringify(serverNow)===JSON.stringify(local)){      // compare-and-set
            if(proposed===null) delete data[r.path]; else data[r.path] = clone(proposed);
            notify(r.path);
            return {committed:true, snapshot:snap(data[r.path])};
          }
          stats.conflicts++;
          local = clone(serverNow);        // stale: re-run the update function on the real value
        }
        throw new Error('fake firebase: transaction retried too many times');
      },
    };
    return {app, db, auth};
  }
  // A closed browser tab's Firebase connection dies with it; model that so a closed test device
  // stops receiving pushes (otherwise Node-side timers keep delivering into a dead window).
  function disconnect(clientName){
    for(let i=listeners.length-1; i>=0; i--) if(listeners[i].client===clientName) listeners.splice(i,1);
  }
  return {data, stats, modulesFor, disconnect};
}

/* ------------------------------ fake Claude storage ------------------------------ */
function createFakeClaudeStorage(){
  const map = new Map();
  return {
    map,
    api: {
      async get(key){ await sleep(1+Math.random()*4); if(!map.has(key)) throw new Error('key not found'); return {key, value: map.get(key), shared:true}; },
      async set(key, value){ await sleep(1+Math.random()*4); map.set(key, value); return {key, value, shared:true}; },
    },
  };
}

/* ------------------------------ device harness ------------------------------ */
const allDevices = [];
function openDevice({url, html, setup, seedLocalStorage}){
  const pageErrors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => pageErrors.push(e.message || String(e)));
  vc.on('error', e => pageErrors.push(String(e)));
  const dom = new JSDOM(html, {
    url, runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc,
    beforeParse(w){
      if(seedLocalStorage) for(const [k,v] of Object.entries(seedLocalStorage)) w.localStorage.setItem(k, v);
      if(setup) setup(w);
    },
  });
  const dev = {
    dom, pageErrors,
    ev: expr => dom.window.eval(expr),
    text: () => dom.window.document.body.textContent,
    setInput(id, value){
      const el = dom.window.document.getElementById(id);
      el.value = value;
      el.dispatchEvent(new dom.window.Event('input', {bubbles:true}));
    },
    click(label){
      const b = [...dom.window.document.querySelectorAll('button')].find(b=>b.textContent.includes(label));
      if(!b) throw new Error(`no "${label}" button on screen`);
      if(b.disabled) throw new Error(`"${label}" button is disabled`);
      b.click();
    },
  };
  allDevices.push(dev);
  return dev;
}
// Build test variants from whatever HF_CONFIG.firebase currently holds (blank or a real project),
// so the tests never depend on — or talk to — the real Firebase project configured in the file.
const FIREBASE_BLOCK = /firebase: \{[^}]*\},/;
if(!FIREBASE_BLOCK.test(BASE_HTML)) throw new Error('could not find HF_CONFIG.firebase block — layout changed?');
const withFirebaseConfig = cfg => BASE_HTML.replace(FIREBASE_BLOCK,
  `firebase: { apiKey: '${cfg.apiKey}', authDomain: '', databaseURL: '${cfg.databaseURL}', projectId: '', appId: '' },`);
const firebaseHtml = withFirebaseConfig({apiKey:'test-key', databaseURL:'https://test-default-rtdb.firebaseio.com'});
const unconfiguredHtml = withFirebaseConfig({apiKey:'', databaseURL:''});
const GITHUB_URL = 'https://someone.github.io/hand-and-foot/handfoot.html';
const CLAUDE_URL = 'https://abc123.claudeusercontent.com/';

async function main(){

  /* ================================ FIREBASE ================================ */
  console.log('--- Firebase backend ---');
  const fb = createFakeFirebaseServer();
  const fbDevice = name => openDevice({url:GITHUB_URL, html:firebaseHtml, setup:w=>{ w.__HF_FIREBASE_MODULES__ = fb.modulesFor(name); }});

  const alice = fbDevice('alice');
  await waitFor(()=>alice.ev('backendStatus')==='ready', 'alice connected');
  assert(alice.ev('backend.name')==='firebase', 'auto mode picks Firebase on a non-Claude host when HF_CONFIG.firebase is filled in');
  assert(alice.text().includes('Sync: Firebase'), 'landing shows which sync backend is active');

  alice.setInput('nameInput', 'Alice');
  alice.click('Create a room');
  await waitFor(()=>alice.ev('netState && netState.code'), 'room created');
  const code = alice.ev('netState.code');
  assert(/^[A-Z]{4}$/.test(code), `room created with code ${code}`);
  const stored = fb.data['hfRooms/'+code];
  assert(stored && typeof stored.json==='string' && typeof stored.rev==='number', 'room is stored as {json, rev, updatedAt}, not a native Firebase tree');

  // Two people join at the same instant — the race the old read-then-write flow lost.
  const bob = fbDevice('bob'), cara = fbDevice('cara');
  await waitFor(()=>bob.ev('backendStatus')==='ready' && cara.ev('backendStatus')==='ready', 'bob & cara connected');
  bob.setInput('nameInput', 'Bob');  bob.setInput('codeInput', code);
  cara.setInput('nameInput', 'Cara'); cara.setInput('codeInput', code);
  const conflictsBefore = fb.stats.conflicts;
  bob.click('Join room'); cara.click('Join room');
  await waitFor(()=>bob.ev('netState && ui.screen==="lobby"') && cara.ev('netState && ui.screen==="lobby"'), 'both joined');
  await waitFor(()=>alice.ev('netState.players.length')===3, 'alice sees 3 players via live push', 3000).catch(()=>{});
  const names = alice.ev('netState.players.map(p=>p.name).join(",")');
  assert(names==='Alice,Bob,Cara' || names==='Alice,Cara,Bob', `simultaneous joins both land, neither erases the other (players: ${names})`);
  assert(fb.stats.conflicts > conflictsBefore, `transactions really did collide and retry during the joins (${fb.stats.conflicts-conflictsBefore} conflicts resolved) — so the join test exercised the race, not just sequential writes`);

  // Rejoin by name (existing feature) must not add a duplicate seat.
  const bobAgain = fbDevice('bob2');
  await waitFor(()=>bobAgain.ev('backendStatus')==='ready', 'bob2 connected');
  bobAgain.setInput('nameInput', 'bob'); bobAgain.setInput('codeInput', code);
  bobAgain.click('Join room');
  await waitFor(()=>bobAgain.ev('netState && ui.screen==="lobby"'), 'bob rejoined by name');
  assert(bobAgain.ev('me.id')===bob.ev('me.id'), 'rejoining with the same name (any capitalization) reclaims the same seat');
  assert(JSON.parse(fb.data['hfRooms/'+code].json).players.length===3, 'name rejoin writes nothing — still 3 players');
  fb.disconnect('bob2'); bobAgain.dom.window.close();

  // Host starts the game; everyone moves to the table via live push.
  alice.click('Start game');
  const devices = [alice, bob, cara];
  await waitFor(()=>devices.every(d=>d.ev('netState.phase')==='playing'), 'all see game started');
  await waitFor(()=>devices.every(d=>d.text().includes('Hand 1/4')), 'all rendered the table');
  assert(true, 'host started the game and all three devices switched to the table');

  const serverState = () => JSON.parse(fb.data['hfRooms/'+code].json);
  const activeId = () => serverState().turnOrder[serverState().turnIndex];
  const deviceFor = id => devices.find(d=>d.ev('me.id')===id);

  // Double-tap guard: two taps of "Draw 2" must draw 2 cards, not 4.
  const actor = deviceFor(activeId());
  const handBefore = serverState().hands[activeId()].length;
  actor.ev('actDrawTwo(); actDrawTwo();');
  await waitFor(()=>serverState().turnHasDrawn, 'draw landed');
  await sleep(150);
  assert(serverState().hands[activeId()].length===handBefore+2, `a double-tapped "Draw 2" draws exactly 2 (hand ${handBefore} -> ${serverState().hands[activeId()].length})`);
  for(const d of devices){
    await waitFor(()=>d.ev('netState.turnHasDrawn')===true, 'draw pushed to '+d.ev('me.name'));
  }
  assert(true, 'the draw reached every device via live push, no polling');

  // Turn guard: a stale device acting out of turn is refused, and nothing changes.
  const bystander = devices.find(d=>d.ev('me.id')!==activeId());
  const bystanderId = bystander.ev('me.id');
  const bystanderHand = serverState().hands[bystanderId].length;
  const revBefore = serverState().rev;
  await bystander.ev('pushState(s=>drawTwoStock(s, me.id))');
  assert(/not your turn/i.test(bystander.ev('ui.error')), `out-of-turn action refused with a clear message ("${bystander.ev('ui.error')}")`);
  assert(serverState().hands[bystanderId].length===bystanderHand && serverState().rev===revBefore, 'refused action changed nothing on the server');

  // Finish the turn: skip melding, discard, turn advances everywhere.
  actor.click('Skip melding');
  await waitFor(()=>actor.ev('netState.turnPhase')==='discard', 'discard phase');
  const firstCard = actor.dom.window.document.querySelector('.hand-row .card.clickable');
  firstCard.click();
  actor.click('Discard selected');
  await waitFor(()=>serverState().turnPhase==='draw' && activeId()!==actor.ev('me.id'), 'turn advanced');
  const next = deviceFor(activeId());
  await waitFor(()=>next.text().includes('Your turn'), 'next player sees their turn');
  assert(true, `discard ended the turn and ${next.ev('me.name')}'s device shows "Your turn"`);

  // Seat memory: a refreshed device offers one-tap rejoin into the same seat.
  const bobSession = bob.dom.window.localStorage.getItem('hf_session_v1');
  assert(!!bobSession && JSON.parse(bobSession).code===code, 'seat remembered in localStorage off Claude');
  const bobRefreshed = openDevice({url:GITHUB_URL, html:firebaseHtml, seedLocalStorage:{hf_session_v1:bobSession}, setup:w=>{ w.__HF_FIREBASE_MODULES__ = fb.modulesFor('bob-refreshed'); }});
  await waitFor(()=>bobRefreshed.ev('backendStatus')==='ready', 'refreshed bob connected');
  assert(bobRefreshed.text().includes(`Rejoin room ${code} as Bob`), 'after a refresh the landing offers "Rejoin room CODE as Bob"');
  bobRefreshed.click('Rejoin room');
  await waitFor(()=>bobRefreshed.ev('netState && ui.screen==="table"'), 'refreshed bob back at table');
  assert(bobRefreshed.ev('me.id')===bob.ev('me.id'), 'one-tap rejoin restores the exact same seat, mid-game');

  // A stale session for a room that no longer has you is cleared, not a dead end.
  const ghost = openDevice({url:GITHUB_URL, html:firebaseHtml, seedLocalStorage:{hf_session_v1:JSON.stringify({code, playerId:'pNOBODY', name:'Ghost'})}, setup:w=>{ w.__HF_FIREBASE_MODULES__ = fb.modulesFor('ghost'); }});
  await waitFor(()=>ghost.ev('backendStatus')==='ready', 'ghost connected');
  ghost.click('Rejoin room');
  await waitFor(()=>/isn't available/.test(ghost.ev('ui.error')), 'stale session reported');
  assert(ghost.dom.window.localStorage.getItem('hf_session_v1')===null, "a stale saved seat is reported and cleared instead of getting stuck");

  // Joining a room that doesn't exist.
  const stranger = fbDevice('stranger');
  await waitFor(()=>stranger.ev('backendStatus')==='ready', 'stranger connected');
  stranger.setInput('nameInput', 'Zed'); stranger.setInput('codeInput', code==='ZZZZ'?'YYYY':'ZZZZ');
  stranger.click('Join room');
  await waitFor(()=>/No room found/.test(stranger.ev('ui.error')), 'missing room reported');
  assert(true, 'joining a nonexistent room says "No room found" (the null-first transaction path)');

  /* ================================ CLAUDE ================================ */
  console.log('--- Claude storage backend ---');
  const cs = createFakeClaudeStorage();
  const localStorageWrites = [];
  let firebaseTouched = false;
  const claudeDevice = () => openDevice({url:CLAUDE_URL, html:firebaseHtml /* config filled in on purpose: auto must still pick Claude */, setup:w=>{
    w.storage = cs.api;
    const origSet = w.Storage.prototype.setItem;
    w.Storage.prototype.setItem = function(k,v){ localStorageWrites.push(k); return origSet.call(this,k,v); };
    Object.defineProperty(w, '__HF_FIREBASE_MODULES__', {get(){ firebaseTouched = true; return undefined; }});
  }});
  const c1 = claudeDevice();
  await waitFor(()=>c1.ev('backendStatus')==='ready', 'claude device ready');
  assert(c1.ev('backend.name')==='claude', 'auto mode picks Claude storage inside Claude even with Firebase configured — one file serves both');
  c1.setInput('nameInput', 'Host'); c1.click('Create a room');
  await waitFor(()=>c1.ev('netState && netState.code'), 'claude room created');
  const ccode = c1.ev('netState.code');
  assert(cs.map.has('hf2026_room_'+ccode), 'room saved under the same storage key as before, so existing links keep working');
  const c2 = claudeDevice();
  await waitFor(()=>c2.ev('backendStatus')==='ready', 'claude device 2 ready');
  c2.setInput('nameInput', 'Guest'); c2.setInput('codeInput', ccode); c2.click('Join room');
  await waitFor(()=>c2.ev('netState && ui.screen==="lobby"'), 'guest joined');
  await waitFor(()=>c1.ev('netState.players.length')===2, 'host sees guest via polling');
  c1.click('Start game');
  await waitFor(()=>c2.ev('netState.phase')==='playing', 'guest sees start via polling');
  const cActive = [c1,c2].find(d=>d.ev('me.id===netState.turnOrder[netState.turnIndex]'));
  const cOther = [c1,c2].find(d=>d!==cActive);
  cActive.click('Draw 2 from stock');
  await waitFor(()=>cOther.ev('netState.turnHasDrawn')===true, 'draw arrives via polling');
  assert(true, 'Claude backend: create, join, start, and a draw all sync between devices via polling');
  assert(localStorageWrites.length===0, 'Claude mode never writes browser storage');
  assert(!firebaseTouched, 'Claude mode never tries to load Firebase (external scripts are blocked there)');

  /* ================================ CONFIG ERRORS ================================ */
  console.log('--- configuration errors ---');
  const unconfigured = openDevice({url:GITHUB_URL, html:unconfiguredHtml});
  await waitFor(()=>unconfigured.ev('backendStatus')==='error', 'unconfigured reports error');
  assert(/FIREBASE_SETUP/.test(unconfigured.text()), 'hosted without Firebase config: clear message pointing at FIREBASE_SETUP.md');
  assert(unconfigured.dom.window.document.querySelector('button[onclick="actCreateRoom()"]').disabled, 'create/join disabled until a backend is ready');
  const forcedClaude = openDevice({url:GITHUB_URL+'?backend=claude', html:firebaseHtml});
  await waitFor(()=>forcedClaude.ev('backendStatus')==='error', 'forced claude off-claude reports error');
  assert(/storage isn't available/.test(forcedClaude.text()), '?backend=claude outside Claude explains itself instead of failing silently');

  const errs = allDevices.flatMap(d=>d.pageErrors);
  assert(errs.length===0, `no uncaught page errors on any device${errs.length?': '+errs.slice(0,3).join(' | '):''}`);
}

main()
  .catch(e=>{ console.log('FAIL:', e.message); failures++; })
  .finally(()=>{
    for(const d of allDevices){ try{ d.dom.window.close(); }catch(e){} }
    console.log(failures===0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
    process.exit(failures===0 ? 0 : 1);
  });
