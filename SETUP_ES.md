# Preparar VeilFarers VTT

## Usar el proyecto sin Firebase

Firebase no es obligatorio para abrir el tablero, importar personajes JSON, guardar campañas en este navegador o jugar por PeerJS. Las campañas locales no se sincronizan automáticamente entre dispositivos: exporta una copia JSON como respaldo.

1. Instala Node.js 22.12 o superior dentro de la versión 22, o Node.js 24 LTS.
2. Desde la carpeta del proyecto, ejecuta `npm ci`.
3. Ejecuta `npm run dev` y abre la dirección que muestra Vite.
4. Para comprobar la instalación, ejecuta `npm test` y `npm run release:check`.

En Windows también puedes usar los lanzadores descritos en [README.md](README.md). Para jugar en red local sigue [PRUEBAS_LOCALES.md](PRUEBAS_LOCALES.md).

## Desplegar en Netlify

El archivo `netlify.toml` configura Node.js 22, el comando de compilación y la publicación de `dist`. Netlify ejecuta la compilación al desplegar; no hace falta subir esa carpeta al repositorio. La aplicación principal se abre en `/` y el laboratorio de efectos en `/fx-lab.html`.

Sin configurar Firebase puedes usar el tablero y las invitaciones de Session. Los despliegues estáticos usan PeerJS/WebRTC; el transporte LAN requiere el servidor de desarrollo y no funciona como servidor multijugador en Netlify. El Keeper debe mantener abierta su pestaña. Algunas redes necesitan infraestructura TURN adicional para conectar a los participantes.

## Firebase opcional: cuentas y biblioteca en la nube

La aplicación ya incluye una integración de Firebase para inicio de sesión con correo y contraseña, versiones de personajes, preferencias e imágenes de escenas. Firebase no aloja la partida multijugador en directo. Estos pasos conectan esa integración existente; no necesitas una cuenta de servicio.

1. Abre [Firebase Console](https://console.firebase.google.com/), crea o selecciona un proyecto y registra una aplicación **Web** desde la configuración del proyecto. No necesitas activar Firebase Hosting para publicar en Netlify.
2. En **Authentication → Sign-in method**, activa **Email/Password**. En **Settings → Authorized domains**, añade `vfvtt.netlify.app` y, para pruebas locales, `localhost`. Si usas un dominio propio o un Deploy Preview para probar el acceso, añade también su hostname exacto, sin protocolo ni ruta.
3. Crea la base de datos **Cloud Firestore**, con el identificador predeterminado y reglas de producción. Escoge su región antes de crearla.
4. Crea el bucket predeterminado en **Storage**. Firebase Storage requiere el plan **Blaze**: revisa sus costes y configura alertas de presupuesto antes de activarlo. Las alertas no limitan el gasto. Consulta los [requisitos oficiales](https://firebase.google.com/docs/storage/web/start).
5. En la configuración de la aplicación Web, localiza los cinco campos siguientes. Introduce sus valores únicamente en tu configuración local o en Netlify, nunca en un archivo versionado:

   | Campo de Firebase | Variable que lee la aplicación |
   | --- | --- |
   | `apiKey` | `VITE_FIREBASE_API_KEY` |
   | `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
   | `projectId` | `VITE_FIREBASE_PROJECT_ID` |
   | `storageBucket` | `VITE_FIREBASE_STORAGE_BUCKET` |
   | `appId` | `VITE_FIREBASE_APP_ID` |

   Para desarrollo local, copia `.env.example` a `.env.local` y completa los campos en tu equipo. Usa el nombre exacto del bucket de la consola, que puede terminar en `.firebasestorage.app`. No necesitas `measurementId` ni `messagingSenderId` para esta integración.

6. En **Netlify → Project configuration → Environment variables**, añade esas cinco variables para el contexto donde quieras usar Firebase y con disponibilidad durante la compilación. Asegúrate de que `VITE_LOCAL_ONLY` no esté establecido en `1`. Vite incorpora las variables `VITE_` al navegador: no introduzcas claves privadas, contraseñas ni credenciales de cuentas de servicio en ellas.
7. Publica el contenido de [firestore.rules](firestore.rules) en **Firestore → Rules** y el de [storage.rules](storage.rules) en **Storage → Rules**. Pulsa **Publish** en ambos. Las reglas restringen los documentos y las operaciones de almacenamiento al propietario. No uses reglas públicas de prueba.
8. Reinicia Vite si trabajas en local. En Netlify, inicia un nuevo despliegue para incorporar las variables a los archivos publicados; cambiarlas sin recompilar no actualiza el navegador.

## Comprobar Firebase

Abre **Sign in**, crea una cuenta y vuelve a iniciar sesión. Guarda un personaje y las preferencias; comprueba que aparecen al acceder desde otro navegador. Sube una imagen desde **Scenes → New scene**, recarga y reutilízala desde la biblioteca. Con una segunda cuenta comprueba que la biblioteca privada de la primera no aparece.

Los enlaces de descarga de mapas permiten ver la imagen a quien los tenga; los jugadores reciben el enlace del mapa activo. No compartas imágenes secretas mediante una escena activa.

Si aparece un error de configuración, revisa que estén presentes las cinco variables, que el modo local no esté activado y que hayas desplegado de nuevo. Para `auth/unauthorized-domain`, revisa el hostname en Authentication. Para errores de permisos, revisa la sesión iniciada y que hayas publicado las reglas en el mismo proyecto. Para errores de subida, comprueba el bucket, la facturación y las reglas de Storage.

La conexión real, los permisos y las subidas requieren tu proyecto Firebase configurado. Consulta [FIREBASE_SETUP.md](FIREBASE_SETUP.md) para los detalles y las comprobaciones adicionales de la integración existente.
