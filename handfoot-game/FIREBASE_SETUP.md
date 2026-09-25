# Hosting Hand & Foot on GitHub Pages with Firebase

About 15 minutes, one time. When you're done, the game runs at
`https://<your-username>.github.io/<repo-name>/` with no Claude account needed, live updates
instead of polling, and a one-tap "Rejoin" after a refresh.

The same `handfoot.html` keeps working as your Claude artifact. It detects where it's running and
picks the right storage automatically, so there is only ever one version of the game.

**Cost:** Firebase's free Spark plan, no credit card. At the time of writing its Realtime Database
allowance is 1 GB stored, 10 GB downloaded per month, and 100 simultaneous connections. A game room
is about 9–17 KB, so you won't come near any of it.

Firebase's console layout shifts from time to time. If a menu below isn't exactly where described,
search for the feature by name in the console's search bar.

---

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com and sign in with a Google account.
2. **Create a project.** Any name works, e.g. `hand-and-foot`. You can turn Google Analytics off.

## 2. Create the database

1. In the left menu open **Realtime Database** (under *Build*), then **Create database**.
   - Make sure it's **Realtime Database**, not *Firestore*. The game is written for Realtime Database.
2. Pick the location closest to your players.
3. Choose **Start in locked mode**. You'll replace the rules in the next step anyway.
4. Open the **Rules** tab. Delete what's there, paste the entire contents of `firebase-rules.json`
   from this repo, and click **Publish**.
   - What the rules do: players must be signed in (the game does this invisibly), can only touch
     rooms with 4-letter codes, and can't list or browse other rooms, only open a code they know.
   - If the editor rejects the rules, publish this minimal version instead and tell me the error
     so I can fix the full one:
     ```json
     { "rules": { "hfRooms": { "$code": { ".read": "auth != null", ".write": "auth != null" } } } }
     ```
5. Back on the **Data** tab, copy the database URL shown at the top. It looks like
   `https://hand-and-foot-default-rtdb.firebaseio.com`, or for some regions
   `https://hand-and-foot-default-rtdb.europe-west1.firebasedatabase.app`. You need it in step 4.

## 3. Turn on anonymous sign-in

1. Left menu: **Authentication** → **Get started**.
2. **Sign-in method** tab → **Anonymous** → **Enable** → **Save**.

Players never see a login. Each device silently gets an anonymous identity, which is what the
database rules check for.

## 4. Get your config and paste it into the game

1. Click the gear icon → **Project settings**. Under **Your apps**, click the web icon (`</>`).
2. Register the app with any nickname. Leave "Firebase Hosting" **unchecked**, since GitHub Pages is
   your host.
3. You'll see a `firebaseConfig` block. Copy these five values into the `HF_CONFIG` block near the
   top of `handfoot.html`:

   ```js
   const HF_CONFIG = {
     backend: 'auto',
     firebase: {
       apiKey: 'AIza…',
       authDomain: 'hand-and-foot.firebaseapp.com',
       databaseURL: 'https://hand-and-foot-default-rtdb.firebaseio.com',
       projectId: 'hand-and-foot',
       appId: '1:…:web:…',
     },
   };
   ```

   **If the snippet has no `databaseURL`**, which is common, paste the URL you copied in step 2.5.
   The game can't connect without it.

   Two easy mix-ups:
   - The **browser address bar** on the database page (`console.firebase.google.com/.../data/...`)
     is *not* the database URL. The database URL ends in `.firebaseio.com` or
     `.firebasedatabase.app`.
   - Copy only the **values**. Skip the `import` lines, `initializeApp`, and `getAnalytics` from
     Firebase's snippet; the game loads Firebase itself. Extra keys like `storageBucket` or
     `measurementId` aren't needed either.

These values are fine to commit to a public GitHub repo. A Firebase web config only identifies
your project; it isn't a password. Access is controlled by the rules you published in step 2.
Firebase's own documentation says the same.

## 5. Publish on GitHub Pages

Same as your other GitHub Pages projects:

1. Create a new repository (e.g. `hand-and-foot`) and push this whole folder to it.
   `index.html` forwards to `handfoot.html`, so the site root opens the game.
2. **Settings** → **Pages** → Source: *Deploy from a branch* → branch `main`, folder `/ (root)` → **Save**.
3. After a minute or two the game is live at `https://<your-username>.github.io/hand-and-foot/`.

After any future change, push to GitHub and Pages redeploys. There's no "republish" step like with
Claude, and the link never changes.

## 6. Check it works

1. Open the site. At the bottom of the start screen it should say **Sync: Firebase**.
2. Create a room on one device and join from another, ideally a phone on cellular data so you're
   testing over the real internet rather than your home network.

### If something's wrong

The start screen explains most problems in plain language:

| Message | Fix |
|---|---|
| *No way to sync games is set up…* | `HF_CONFIG.firebase` is still empty, or the pushed copy isn't the edited one |
| *Anonymous sign-in is turned off…* | Step 3 |
| *…isn't on Firebase's authorized domains list* | Authentication → Settings → Authorized domains → add `<your-username>.github.io` |
| *databaseURL is missing or wrong* | Step 4, the `databaseURL` note |
| *Firebase refused the request…* | The step 2.4 rules weren't published |
| Still says *Connecting…* forever | Open the browser's developer console and look for red errors |

A hard refresh (or a private/incognito window) rules out an old cached copy of the page.

---

## Choosing the backend manually

`backend: 'auto'` is the right setting almost always. To force one for a single visit, add a URL
parameter: `…/handfoot.html?backend=firebase` or `?backend=claude`.

## What changes for players

- **No Claude account needed.** It's a normal web page.
- **Instant updates.** Moves appear on other devices the moment they're made, with no ~2-second polling delay.
- **"Rejoin room ABCD as Name"** after a refresh or a phone locking up. Rejoining by typing the same
  name still works too.

Rooms from the Claude artifact and rooms on Firebase are separate. A game started in one can't be
continued in the other.
