# 🌌 Veilfarers VTT

A Virtual Tabletop (VTT) custom-crafted for **Veilfarers**, featuring **Google Authentication**, **Firebase** real-time multiplayer synchronization, interactive multi-layer battlemap canvas, dice rolling with sound & confetti effects, combat tracker, and character sheets. Ready for hosting on **Netlify**.

---

## ✨ Features

- **🛡️ Google Authentication & Guest Mode**:
  - One-click Google Sign-in with popup auth.
  - Seamless fallback guest mode for instant play without waiting for keys.
- **⚡ Firebase Cloud Synchronization**:
  - Live token dragging, rotation, and stat updates via Cloud Firestore.
  - Multiplayer chat and dice roll cards with critical success & failure fanfare.
  - Active party presence indicators.
- **🗺️ Interactive Tactical Tabletop Canvas**:
  - Smooth Pan & Zoom (anchored at cursor, zoom buttons + reset).
  - Square & Hexagonal grid support with adjustable size, opacity, color, and grid snapping.
  - 4 Built-in atmospheric battlemaps (Sanctum of the Veil, Citadel Ruins, Astral Void, Forgotten Crypts) + custom image URL & local file upload support.
  - Measurement Ruler (feet & cell calculation).
  - Radar Ping tool with animated expanding sonar waves and sound effects.
  - Freehand drawing annotations with color picker and brush size.
  - Fog of War (GM reveal / shroud brushes with GM translucent visibility).
- **🎲 Polyhedral Dice Roller & Veil Strain**:
  - d4, d6, d8, d10, d12, d20, d100 with advantage & disadvantage.
  - Formula parser (e.g., `/r 2d20kh1 + 4`, `4d6kh3 + 2`).
  - Veilfarers **Veil Strain** risk mechanic (+1 Corruption).
  - Natural 20 celebration confetti and procedural Web Audio sound effects.
- **⚔️ Combat Initiative Tracker**:
  - Sorted combatants list with current turn highlight.
  - Quick HP adjustment buttons (+ / -).
  - Turn cycle & round advancement.
- **📜 Veilfarers Character Sheet**:
  - Might, Agility, Wits, Willpower, and Resonance attributes.
  - Click-to-roll stats directly to the party chat.
  - Health, Aether, and Veil Strain resource tracking.
  - Relics and equipment inventory.

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Start Vite dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔑 Firebase Setup (Google Auth + Firestore)

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. In **Build > Authentication**:
   - Enable **Google** as a Sign-in provider.
   - Add your Netlify domain (e.g. `your-app.netlify.app`) to the **Authorized domains** list.
3. In **Build > Firestore Database**:
   - Create a database in test mode (or configure standard security rules).
4. In **Project settings > General > Your apps**:
   - Register a Web App (`</>`) and copy the config credentials.
5. Create a `.env.local` file in the root directory (based on `.env.example`):

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:...
```

*(Note: You can also configure these keys right in the application UI via the **Settings** gear icon without rebuilding!)*

---

## 🌐 Deploying to Netlify

1. Push this repository to GitHub or GitLab.
2. Go to [Netlify](https://app.netlify.com/) and select **Add new site > Import an existing project**.
3. Choose your repository.
4. The build settings will automatically be detected from `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Go to **Site configuration > Environment variables** in Netlify and add the variables from `.env.example`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
6. Click **Deploy site**.
7. In the Firebase Console, add your newly generated Netlify domain (e.g. `your-vtt.netlify.app`) to **Authentication > Settings > Authorized domains**.

---

## 📜 License
MIT
