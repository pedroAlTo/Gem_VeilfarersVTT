# VeilFarers VTT · Orbital IV

A local-first virtual tabletop with scene travel, a player roster, shared drones, character JSON import, optional Firebase accounts, and a Three.js Hope & Fear dice tray.

## Run locally

Use **INICIAR_VTT_LOCAL.bat** for isolated offline tests, or **INICIAR_VTT_ONLINE.bat** for online play and optional Firebase features. Both use the locked dependencies and require Node.js 22.12+ or Node.js 24 LTS. Initial dependency installation needs internet.

On macOS/Linux: `npm ci`, then `npm run dev`. Run `npm test` and `npm run build` for automated checks. Open the printed local URL rather than opening index.html from disk. Windows launchers have been reviewed but not executed on Windows in this environment.

## Play

- **Session** → Host game: name the current campaign and copy its invitation. Players paste the complete code or link and enter their call sign. An account is optional. The top menu always shows connection state, campaign name and invitation.
- **Session** → Player roster: the Keeper assigns any non-drone token to a player. Reassignment releases that player's previous token. Players can import their own character or use a cloud character; replacement keeps their existing token and assignment.
- **My tokens** opens the character and shared drones you control in the current scene. Select one to center the map, move it, aim its facing handle, make a check or edit its current resources in **Ficha**. The Keeper manages assignments and resource limits.
- **Anomaly color** opens a palette for lightning and laser effects. Drag in the color field, adjust hue, choose a swatch or enter a hex value. The effect previews the selected color immediately.
- **Roster** → + Actor → Drone: create a drone. In its **Ficha → Player controls**, select multiple controllers. Drone controls are also available in Session. Non-drone tokens allow one controller; a player may control one non-drone plus several drones.
- **Scenes**: switching or creating a scene moves player characters, assigned NPCs and controlled drones. Encounter enemies stay behind. Returning restores per-scene positions, clamped to map bounds. Keeper-owned legacy enemies are not party members.
- **Dice → Open tray**: opens a compact overlay at the map’s top right. Minimize it to keep just the results, or close it; the map remains interactive. Open **Dice settings (⚙)** for Crystal caves, Tech panels, Circuits & processors, Galaxy & stars, test throws, automatic display, reduced motion and camera controls. Hope stays cyan and Fear stays magenta, with clear labels. The finishes use detailed color/relief/illumination maps, beveled edges, reflected light and clearcoat. Three.js WebGL 2 renders real d12 meshes; cannon-es runs collisions at 120 Hz. Throws use lower launch/spin speeds and mat friction to settle naturally, without kicks or teleports. Cocked or overlong trajectories are rejected before animation. Game checks preserve the authoritative result; test throws are cosmetic. Drag to orbit or scroll/pinch to zoom. WebGL-disabled devices retain the numeric game result and show a support message.
- **Sign in**: save character versions and preferences. **New scene** can upload an image to your server library. See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for the required Firebase project, rules and environment values. This repository does not contain a connected Firebase project.

Live sessions use PeerJS/WebRTC and the public PeerServer for signaling. The Keeper's tab must remain open; there is no persistent multiplayer game server or automatic host migration. Up to six connected players. Network restrictions may require your own TURN infrastructure. A dropped player can reconnect with the same invitation and browser-session identity while the host remains open. Imported sheets are validated by the Keeper's client; the application does not independently verify a player's claimed character stats against an external game account.

Changes are on `fix/vtt-session-integrity-and-orbital-ui`. See [RELEASE_ORBITAL.md](RELEASE_ORBITAL.md) for history and [PRUEBAS_LOCALES.md](PRUEBAS_LOCALES.md) for the offline test launcher.
