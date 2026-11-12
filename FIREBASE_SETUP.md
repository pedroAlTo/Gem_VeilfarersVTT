# Firebase del VTT: cuentas, salas e imágenes

Desde v1.4.0 las salas online usan **Firebase Authentication + Firestore** para miembros, presencia, transporte privado y campaña persistente. El proyecto debe ser **exclusivo del VTT**, separado del portal público. Esta entrega no cambia ni despliega ningún proyecto de producción. Los modos local y LAN siguen funcionando sin Firebase; sin configuración Firebase, el modo online conserva la conexión temporal PeerJS anterior.

**Actualizar el JavaScript no basta:** publica las reglas y los índices de esta versión en el proyecto del VTT antes de probar las salas. Una cuenta Netlify Identity, por sí sola, no autentica en Firestore: las salas requieren Google o correo de Firebase. No hay migración automática de códigos temporales ni de antiguas identidades por nombre.

1. Create or select your Firebase project and register a Web app in Project settings.
2. Enable Authentication → Email/Password and/or Google. Add your deployment hostname and `localhost` to Authentication → Authorized domains. Set your password policy and password-reset email template.
3. Create a Firestore database. Create the default Storage bucket. **Firebase Storage currently requires the Blaze billing plan**; review billing and set budget alerts before enabling it. No billing change is made by this code. [Official prerequisite](https://firebase.google.com/docs/storage/web/start).
4. Copy `.env.example` to `.env.local`. Copy the five public web configuration values from Firebase into it. Use the exact bucket from the console (new buckets commonly end in `.firebasestorage.app`). Do not put service-account credentials in Vite variables; Vite variables are public browser configuration.
5. Publish `firestore.rules` and `storage.rules` using the Rules tabs in the Firebase console, or run `npx firebase deploy --only firestore:rules,firestore:indexes,storage --project YOUR_VTT_PROJECT_ID` from this directory after signing into the CLI. Default-deny rules keep each account's library isolated. Do not use test-mode public rules.
6. Run `INICIAR_VTT_ONLINE.bat` on Windows, or `npm ci` then `npm run dev`. Restart after changing environment values. For a deployed build, supply these variables at build time and rebuild.

## Using the features

- **Sign in** in the top menu. Create an account, or use an existing Firebase account. “Keep me signed in” controls local versus browser-session authentication persistence. Password reset is an explicit user action.
- **Import JSON to library** reviews source data before saving. **Save selected character** creates a dated version, preserving earlier saves. **Use in game** imports into a Keeper campaign, or sends the character to the Keeper in a joined game; replacing your current character preserves its token assignment.
- **Save preferences** stores call sign, audio, grid, dice finish, automatic 3D tray and reduced motion. Preferences are loaded on sign-in. An account switch clears the SDK identity; the Firestore disk cache is not enabled. Unsaved in-game edits are not silently written to a character archive.
- **Scenes → New scene**: upload PNG/JPEG/WebP (20 MB, 6000 px maximum dimension), leave “Save uploaded image and scene to my account” selected, and sign in. The scene is created only after both the image upload and metadata save succeed. Progress and cancellation are available. The server scene library lets you reuse it in another campaign.
- Map download URLs are bearer links: members receive the active scene URL; anyone who already has that URL may be able to view the image independently of room membership. Do not upload secret maps to a shared scene. Library documents and direct storage operations remain owner-only. Revoke a file's download token in Firebase if a link must stop working.
- Turning off server upload keeps an image in the local campaign. An external image URL remains on its existing server; it is not copied to Firebase.

## Acceptance checks with your configured project

Use two different accounts and two browser profiles. Create an account, sign out and back in; save a character and preferences; verify they reappear on the second device. Verify the other account cannot list or read the first account's documents or storage path. Upload a map, refresh, reuse it in a new campaign, and join that scene from the other browser. Deny a storage write and verify no scene is created. Cancel an upload and confirm no listed scene remains.

`npm run test:rooms` evalúa las reglas reales y el transporte con el emulador Firestore y cuentas de prueba. Incluye pérdida de red y caducidad de presencia; no usa credenciales ni datos de producción. OAuth real, subida de imágenes y una partida prolongada en el despliegue necesitan la comprobación manual con tu proyecto.

## Activación y migración a salas persistentes

1. Selecciona explícitamente el proyecto privado del VTT en Firebase. Conserva sus reglas existentes necesarias para otras colecciones; este repositorio incluye las reglas de cuentas, salas y almacenamiento que usa el VTT.
2. Después de `npm ci` y `npx firebase login`, publica las reglas de salas y sus exclusiones de índice:

   ```sh
   npx firebase deploy --only firestore:rules,firestore:indexes --project YOUR_VTT_PROJECT_ID
   ```

3. Configura las variables `VITE_FIREBASE_*` de `.env.example` en el despliegue del VTT y reconstruye con `npm run build`. Usa HTTPS fuera de localhost. Todos los participantes deben cargar v1.4.0.
4. Abre la campaña local que quieres conservar y pulsa **SESIONES → Crear sala**. Se hace una copia con ID independiente, incluidos arcos y escenas. Comparte su nueva invitación VF-… una vez. Las asignaciones antiguas por nombre no se trasladan a otras cuentas: reasígnalas desde la sala.
5. Los miembros usan **Salas en las que juego → Entrar**; el propietario usa **Salas que dirijo → Abrir como Keeper**. El último acceso se recuerda por cuenta para restaurarlo al recargar.

## Comportamiento y persistencia

- La membresía está en `rooms/{roomId}/members/{uid}`. El código solo sirve para la primera aceptación; regenerarlo invalida nuevas entradas con el código anterior y conserva miembros existentes. Una expulsión deja una entrada revocada que el propio jugador no puede restaurar; el Keeper puede readmitirlo.
- El propietario conserva la autoridad del juego. Firestore almacena la campaña privada completa; cada jugador recibe exclusivamente su instantánea filtrada por el Keeper. Los documentos de invitación no se pueden enumerar, ni las campañas privadas leer desde otra cuenta.
- Presencia renovada cada 5 segundos y caducidad de 20 segundos en reglas del servidor. Salir explícitamente pone la sala en pausa; una pestaña cerrada, equipo suspendido o corte de red puede tardar hasta aproximadamente 20 segundos en detectarse. La sala no cambia de dueño.
- El jugador que pierde su conexión queda bloqueado localmente y reintenta. Si pierde al Keeper sigue siendo miembro y espera dentro. Una entrada nueva mientras el Keeper está offline muestra una escena de espera; la campaña real vuelve cuando el propietario se conecta.
- Un estado se confirma al jugador después de que el guardado se haya publicado. Un cambio que aún no ha recibido confirmación puede descartarse al cortar la conexión. El indicador de guardado distingue guardando, confirmado y error; conserva una exportación local si aparece un error persistente.
- Los fragmentos de campaña son inmutables y se reutilizan por contenido. Los mensajes siguientes solo envían secciones modificadas. Mapas alojados por URL evitan transferir imágenes incrustadas; cambiar la imagen o su escena sí requiere enviar esa sección. El límite es 60 MiB de texto JSON por campaña, y 500 trazos de hasta 2000 puntos por escena.
- Mensajes consumidos se eliminan; las conexiones antiguas y fragmentos de guardados que ya no se usan se limpian al abrir como Keeper. Las operaciones consumen cuotas de Firestore. No se promete disponibilidad si Firebase o la red del usuario están caídos.
- Las reglas de dibujos permiten a cada jugador crear/borrar sus trazos a través del Keeper. El Keeper valida sus datos y no acepta autorías falsificadas, borrados ajenos o acciones de una escena anterior.
- Eliminación de salas: El Keeper propietario puede eliminar permanentemente una sala desde la lista o dentro de ella. Esta acción purga la campaña en la nube, elimina la invitación y las conexiones, y expulsa en tiempo real a los jugadores conectados devolviéndolos a su sesión local.

## Verificación sin producción

Necesitas Node 24.12+ y Java 21+. Ejecuta `npm run test:rooms`. Firebase CLI descarga el emulador oficial en la primera ejecución y usa solamente el proyecto ficticio `demo-veilfarers-vtt`. El comando termina cerrando el emulador. Consulta también `PRUEBAS_LOCALES.md` para dos perfiles de navegador, cortes de red, revocaciones y copia de elementos.
