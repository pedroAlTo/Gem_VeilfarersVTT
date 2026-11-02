# VeilFarers VTT · Orbital IV

A local-first virtual tabletop with scene travel, a player roster, shared drones, character JSON import, optional Firebase accounts, and a Three.js Hope & Fear dice tray.

## Run locally

Use **INICIAR_VTT_LOCAL.bat** for isolated offline tests, or **INICIAR_VTT_ONLINE.bat** for online play and optional Firebase features. Both use the locked dependencies and require Node.js 22.12+ or Node.js 24 LTS. Initial dependency installation needs internet.

On macOS/Linux: `npm ci`, then `npm run dev`. Run `npm test` and `npm run build` for automated checks. Open the printed local URL rather than opening index.html from disk. Windows launchers have been reviewed but not executed on Windows in this environment.

## Play

- **Session** → Host game: name the current campaign and copy its invitation. Players paste the complete code or link and enter their call sign. An account is optional. The top menu always shows connection state, campaign name and invitation.
- **Session** → Player roster: the Keeper assigns any non-drone token to a player. Reassignment releases that player's previous token. Players can import their own character or use a cloud character; replacement keeps their existing token and assignment.
- **Roster** → + Actor → Drone: create a drone. In its **Ficha → Player controls**, select multiple controllers. Drone controls are also available in Session. Non-drone tokens allow one controller; a player may control one non-drone plus several drones.
- **Scenes**: switching or creating a scene moves player characters, assigned NPCs and controlled drones. Encounter enemies stay behind. Returning restores per-scene positions, clamped to map bounds. Keeper-owned legacy enemies are not party members.
- **Dice → Open tray**: choose Crystal caves, Tech panels, Circuits & processors, or Galaxy & stars. Hope and Fear have distinct colors and labels. Test throw is cosmetic. Game checks animate their actual authoritative results; physics never rerolls the game outcome. Dice bounce and collide on a raised mat; cocked dice receive a physical nudge. Disable automatic trays or use reduced motion as needed. WebGL uses Three.js materials, shadows and clearcoat; WebGL-disabled devices use the same geometry and physics through a Canvas compatibility renderer.
- **Sign in**: save character versions and preferences. **New scene** can upload an image to your server library. See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for the required Firebase project, rules and environment values. This repository does not contain a connected Firebase project.

Live sessions use PeerJS/WebRTC and the public PeerServer for signaling. The Keeper's tab must remain open; there is no persistent multiplayer game server or automatic host migration. Up to six connected players. Network restrictions may require your own TURN infrastructure. A dropped player can reconnect with the same invitation and browser-session identity while the host remains open. Imported sheets are validated by the Keeper's client; the application does not independently verify a player's claimed character stats against an external game account.

Changes are on `fix/vtt-session-integrity-and-orbital-ui`. See [RELEASE_ORBITAL.md](RELEASE_ORBITAL.md) for history and [PRUEBAS_LOCALES.md](PRUEBAS_LOCALES.md) for the offline test launcher.
