# VeilFarers VTT · Orbital IV

A local-first virtual tabletop with scene travel, a player roster, shared drones, character JSON import, optional Firebase accounts, and a Three.js Hope & Fear dice tray.

## Run locally

On Windows, extract the ZIP and run **INICIAR_VTT_RED_LOCAL.bat** on the Keeper’s PC. Other devices on the same Wi-Fi or Ethernet network open the printed address, for example `http://192.168.1.42:5173/`. Create a game in **Session** and share its invitation. PeerJS needs internet for signaling. Firebase is optional.

**INICIAR_VTT_LOCAL.bat** opens the menu for LAN, single-PC offline play, tests and the effects lab. **INICIAR_VTT_ONLINE.bat** also serves the app on the LAN with online features enabled. The launchers require Node.js 22.12+ or 24 LTS and install locked dependencies on first use.

On macOS/Linux, run `npm ci`, then `npm run dev -- --host 0.0.0.0 --port 5173 --strictPort` for LAN access. Run `node scripts/lan-info.mjs` to display client URLs. For local checks use `npm test` and `npm run build`.

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

Changes are on `fix/vtt-session-integrity-and-orbital-ui`. See [RELEASE_ORBITAL.md](RELEASE_ORBITAL.md) for history and [PRUEBAS_LOCALES.md](PRUEBAS_LOCALES.md) for the Windows launchers and LAN setup.
