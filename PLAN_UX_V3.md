# Plan de UX V3 — jugar en pocos clics, automático y canon

Aprobado por el usuario el 24 nov 2026 («adelante»). Se sigue fase a fase; cada fase se publica
como una versión con su entrada en `src/releaseHistory.js`, `PRUEBAS_LOCALES.md` y `HANDOVER_V2.md`.

## Objetivos

- Cualquier acción del jugador en **3 clics o menos** (4 como máximo absoluto).
- Intuitivo y accesible; crear y unirse a una partida, **muy simple**.
- Las opciones avanzadas siguen ahí para quien las quiera (doble clic, modo Avanzado).
- Cartas, acciones y efectos **automáticos**; las armas aplican sus **features**.
- Todo **acorde al canon** (Corebook 12.06 y Rust & Steel 12.06). Las reglas de la casa ya decididas
  por el usuario se mantienen (HANDOVER) y `System/` no se edita.

## Diagnóstico (24 nov 2026)

| Recorrido | Antes | Meta |
|---|---|---|
| Keeper crea partida y comparte invitación | 5–7 clics + escribir | 2 |
| Jugador entra con enlace | exige cuenta; llega sin personaje | 2 + 1 para el personaje |
| Atacar con arma | 4 (arma, objetivo, confirmar, «Enviar daño») | 3 |
| Tirada de atributo | 2 | 2 |
| Poder nivel 1–3 con objetivo | 3 | 3 |
| Poder nivel 4–10 | 3 + 4–8 del Keeper a mano | 3 en total |
| Reacción | 1 | 1 |

- **Entrar:** online exige cuenta (el invitado es solo local); el inicio mezcla dos papeles, Básico/Avanzado y
  cuatro paneles; el jugador llega a la mesa sin personaje.
- **Cartas:** nivel 1–3, 31 de 49 con mecánica; nivel 4–10, ~85 de 98 solo cobran y tiran (22 de daño, 14
  con condiciones, 13 con salvación, 9 curaciones). Cinco cartas aún abren ventana.
- **Armas:** 231 en catálogo. Glosario del Corebook (58): 19 automáticas, ~25 recordatorio, 14 sin efecto.
  Rust & Steel (31 propiedades nuevas): ninguna aplicada salvo las que coinciden con el Corebook. ~70 tags del
  catálogo sin normalizar (Brutal = Devastating según R&S y no se aplica en 8 armas).
- **Condiciones:** cuentan Blinded, Cornered, Vulnerable, Stunned, Incapacitated y Dazed (parcial); no cuentan
  Prone, Restrained, Weakened, Frightened, Hidden ni Silenced. On Fire y Poisoned por ronda, a mano.

## Fases

0. **Medir siempre.** Recorridos con el navegador y presupuesto de clics (`npm run test:clicks`).
1. **Entrar en dos clics.** Inicio con Crear partida / Unirme / Continuar; unirse con enlace solo con un
   nombre (sesión anónima de Firebase, se puede pasar a cuenta luego); elegir personaje desde la barra del
   jugador (pregenerados de *Hearts in the Void*, mis personajes, crear) sin ventanas forzadas (HANDOVER §1);
   panel de invitación del Keeper.
2. **Actuar en 3 clics.** Primero el objetivo (anillo de acciones al tocar un token); el daño llega solo a la
   ventana del Keeper; valores por defecto en las 5 cartas con ventana; atajos de teclado; Básico/Avanzado en
   la mesa.
3. **Todos los poderes automáticos.** Ficha de procedimiento declarativa por Poder (objetivo, área, tirada,
   daño, salvación, curación, condición con duración, modos, límites), generada del texto y revisada a mano,
   con test por Poder.
4. **Armas según sus features.** Catálogo normalizado, glosario de Rust & Steel, recordatorios convertidos en
   automatismos (salvaciones, relojes, segundo objetivo, áreas, Reload, Paired, Massive, Psionic…).
5. **Condiciones que cuentan solas.** Prone, Restrained, Weakened, Frightened, Hidden, Silenced, Dazed completo;
   fin automático de las condiciones aplicadas por poderes y armas.
6. **Accesibilidad y claridad** (en paralelo). Teclado completo, estados con icono y texto, tamaño ajustable,
   contraste AA, objetivos táctiles de 44 px, ayuda «¿Qué puedo hacer?».

Orden: 0 → 1 → 4 → 2 → 3 → 5, con la 6 en paralelo.

## Decisiones

- Fase 1 aprobada: unirse con enlace sin cuenta y pregenerados de *Hearts in the Void* (24 nov 2026).
- Pendientes de confirmar al llegar a su fase: daño por ronda de On Fire y Poisoned (Bleeding sigue manual,
  decisión 18); quitar el clic «Enviar daño»; anillo de acciones al tocar un token; relanzamiento por defecto
  de Lucky Break.
