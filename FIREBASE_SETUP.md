# Account and scene-image setup

For Spanish instructions, including this project's Netlify deployment and authorized domain, see [SETUP_ES.md](SETUP_ES.md).

This build implements a separate Firebase account (email/password), a private character library, preferences, and scene images. No Firebase project is bundled or connected. Local campaigns, JSON imports, the dice tray and scene movement work without Firebase. Multiplayer still uses PeerJS; Firebase does not host the live game state.

1. Create or select your Firebase project and register a Web app in Project settings.
2. Enable Authentication → Email/Password. Add your deployment hostname and `localhost` to Authentication → Authorized domains. Set your password policy and password-reset email template.
3. Create a Firestore database. Create the default Storage bucket. **Firebase Storage currently requires the Blaze billing plan**; review billing and set budget alerts before enabling it. No billing change is made by this code. [Official prerequisite](https://firebase.google.com/docs/storage/web/start).
4. Copy `.env.example` to `.env.local`. Copy the five public web configuration values from Firebase into it. Use the exact bucket from the console (new buckets commonly end in `.firebasestorage.app`). Do not put service-account credentials in Vite variables; Vite variables are public browser configuration.
5. Publish `firestore.rules` and `storage.rules` using the Rules tabs in the Firebase console, or run `npx firebase-tools deploy --only firestore:rules,storage --project YOUR_PROJECT_ID` from this directory after signing into the CLI. Default-deny rules keep each account's library isolated. Do not use test-mode public rules.
6. Run `INICIAR_VTT_ONLINE.bat` on Windows, or `npm ci` then `npm run dev`. Restart after changing environment values. For a deployed build, supply these variables at build time and rebuild.

## Using the features

- **Sign in** in the top menu. Create an account, or use an existing Firebase account. “Keep me signed in” controls local versus browser-session authentication persistence. Password reset is an explicit user action.
- **Import JSON to library** reviews source data before saving. **Save selected character** creates a dated version, preserving earlier saves. **Use in game** imports into a Keeper campaign, or sends the character to the Keeper in a joined game; replacing your current character preserves its token assignment.
- **Save preferences** stores call sign, audio, grid, dice finish, automatic 3D tray and reduced motion. Preferences are loaded on sign-in. An account switch clears the SDK identity; the Firestore disk cache is not enabled. Unsaved in-game edits are not silently written to a character archive.
- **Scenes → New scene**: upload PNG/JPEG/WebP (20 MB, 6000 px maximum dimension), leave “Save uploaded image and scene to my account” selected, and sign in. The scene is created only after both the image upload and metadata save succeed. Progress and cancellation are available. The server scene library lets you reuse it in another campaign.
- Map download URLs are bearer links: invited players receive the active scene URL and can view its image without creating a Firebase account. Do not upload secret maps to a shared scene. Library documents and direct storage operations remain owner-only. Revoke a file's download token in Firebase if a link must stop working.
- Turning off server upload keeps an image in the local campaign. An external image URL remains on its existing server; it is not copied to Firebase.

## Acceptance checks with your configured project

Use two different accounts and two browser profiles. Create an account, sign out and back in; save a character and preferences; verify they reappear on the second device. Verify the other account cannot list or read the first account's documents or storage path. Upload a map, refresh, reuse it in a new campaign, and join that scene from the other browser. Deny a storage write and verify no scene is created. Cancel an upload and confirm no listed scene remains.

Automated tests cover account-change guards and payload handling with service doubles, plus permissions, invitations, scene movement and dice physics. Real Firebase sign-in, security-rule evaluation and uploads require a configured project and were not exercised in this checkout.
