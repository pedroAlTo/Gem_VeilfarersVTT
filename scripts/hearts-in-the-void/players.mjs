// Hearts in the Void · documents the players may receive (v2.62.0, user request: «préparame
// handouts, notas, recursos para el keeper, logs de ordenadores, PNJ…», in the Dossiers, English and
// Spanish). Each one is shared or transmitted by the Keeper when the fiction reveals it; the in-world
// text keeps the module's words (Hearts in the Void 1.0, rules 12.06) and adds its Spanish version.
import { bi, terminal, sign, note, audio } from './html.mjs';

const doc = (id, title, sender, timestamp, es, en) => ({ id: 'hv_p_' + id, folder: 'Jugadores · Documentos', title, sender, timestamp, contentHtml: bi(es, en) });

export const PLAYER_DOCS = [
  doc('mission', 'Paquete de misión · Mission Packet', 'Maya Santos', 'Crossroads · Nexus Inferior',
    `<h2>Contrato de recuperación</h2>
     <p><strong>Objetivo:</strong> localizar a Alexei Joric, hijo menor del Lord Comandante Maximus Joric, desaparecido hace tres días en el sector Crossroads.</p>
     <ul><li>Determinar si fue secuestrado, ayudado, manipulado o simplemente subestimado.</li>
     <li>Resolver la situación sin dar a las Casas Joric y Valerius una excusa pública para destrozar las rutas comerciales.</li></ul>
     <p><strong>Pista:</strong> los Iron Hearts, una pequeña tripulación mercenaria independiente (capitana: Zara «Starwind» Kaine), viajaron hacia <strong>Charon’s Refuge</strong>, una estación de investigación del sistema Tenebris Secundus. Sigue figurando como operativa, pero su tráfico y sus comunicaciones son irregulares.</p>
     <p><strong>Advertencia:</strong> al menos otros dos intereses buscan a Alexei. Esperad vigilancia, contratistas rivales e información incompleta.</p>
     <table><tr><th>Pago (para toda la tripulación)</th><th>Cantidad</th><th>Condición</th></tr>
     <tr><td>Anticipo operativo</td><td>pagado</td><td>Pasajes, provisiones y gastos de misión. No se devuelve.</td></tr>
     <tr><td>Pago por completar</td><td>15 Créditos</td><td>Localizar a Alexei y dar un informe veraz a Maya.</td></tr>
     <tr><td>Bonificación de resolución</td><td>hasta 15 Créditos</td><td>Evitar que la situación se convierta en un conflicto abierto entre Casas.</td></tr>
     <tr><td>Bonificación negociada</td><td>+5 Créditos</td><td>Solo si se negoció en la reunión.</td></tr></table>
     <p><em>«No os contrato para seguir un guion. Os contrato porque el guion ya ha fallado.»</em></p>`,
    `<h2>Recovery Contract</h2>
     <p><strong>Objective:</strong> locate Alexei Joric, youngest son of Lord Commander Maximus Joric, missing for three days in the Crossroads sector.</p>
     <ul><li>Determine whether he was taken, helped, manipulated, or simply underestimated.</li>
     <li>Resolve the situation without handing House Joric and House Valerius a public excuse to begin tearing trade routes apart.</li></ul>
     <p><strong>Lead:</strong> the Iron Hearts, a small independent mercenary crew (captain: Zara “Starwind” Kaine), travelled toward <strong>Charon’s Refuge</strong>, a research station in the Tenebris Secundus system. It is still listed as operational, but its traffic and communications have become irregular.</p>
     <p><strong>Warning:</strong> at least two other interests are attempting to recover Alexei. Expect surveillance, competing contractors, and incomplete information.</p>
     <table><tr><th>Payment (shared crew payout)</th><th>Amount</th><th>Condition</th></tr>
     <tr><td>Operating Advance</td><td>paid</td><td>Passage, provisions and mission expenses. Never reclaimed.</td></tr>
     <tr><td>Completion Fee</td><td>15 Credits</td><td>Locate Alexei and deliver a truthful debrief to Maya.</td></tr>
     <tr><td>Resolution Bonus</td><td>up to 15 Credits</td><td>Prevent the situation from escalating into an open House conflict.</td></tr>
     <tr><td>Negotiated Bonus</td><td>+5 Credits</td><td>Only if negotiated at the meeting.</td></tr></table>
     <p><em>“I am not hiring you to follow a script. I am hiring you because the script has already failed.”</em></p>`),

  doc('nexus', 'El Nexus Inferior · The Nexus Inferior', 'Crossroads Trade Station', 'Tres niveles bajo el paseo · Three levels below the promenade',
    `<p>Tres niveles por debajo del paseo respetable de Crossroads, donde todo sigue funcionando mientras nadie pregunte cuándo se revisó por última vez. Los pilotos de carga duermen en los reservados entre viaje y viaje; los mercenarios comparan cicatrices sin admitir que las comparan. Hologramas anuncian bebidas de mundos que ya no existen. Un músico celestiari toca bajo uno de ellos y saca una melodía de la luz sólida: hermosa, precisa y tan triste que media sala se ha quedado callada sin admitir por qué.</p>`,
    `<p>Three levels below Crossroads’ respectable promenade, where everything still works provided nobody asks when it was last inspected. Freight pilots sleep in corner booths between runs; mercenaries compare scars without admitting they are comparing scars. Holograms advertise drinks from worlds that no longer exist. A Celestiari musician plays beneath one of them, drawing a melody out of solid light - beautiful, precise, and sad enough that half the room has gone quieter without admitting why.</p>`),

  doc('portraits', 'Dos imágenes de Alexei · Two Images of Alexei', 'Proyector de Maya · Maya’s projector', 'Crossroads',
    `<p><strong>Retrato oficial:</strong> Alexei Joric con uniforme militar de gala, demasiado erguido, con la expresión de alguien a quien le han dicho exactamente dónde poner las manos.</p>
     <p><strong>Imagen de vigilancia (granulada):</strong> Alexei sale de un bar de Nexus-7 con Zara Kaine. Los dos se ríen. El brazo de Zara rodea sus hombros. Alexei la mira a ella, no a la cámara.</p>
     <p><strong>Comunicado oficial de la Casa Joric:</strong> «secuestrado por terroristas». Recompensa pública: 10 Créditos.</p>`,
    `<p><strong>Official portrait:</strong> Alexei Joric in ceremonial military dress, standing too straight, wearing the expression of a man who has been told exactly where to place his hands.</p>
     <p><strong>Surveillance still (grainy):</strong> Alexei leaving a Nexus-7 bar with Zara Kaine. They are both laughing. Zara’s arm is around his shoulders. Alexei is looking at her instead of the camera.</p>
     <p><strong>House Joric official statement:</strong> “abducted by terrorists.” Public reward: 10 Credits.</p>`),

  doc('benefactor', 'Comunicaciones Volkov · Volkov Communications', 'Estación de seguridad, Dock K-17', 'Crossroads',
    terminal(`CANAL CIFRADO // CONTACTO: <strong>BENEFACTOR V</strong>
> Informe de pagos de la semana transferido.
> Orden: vigilar movimientos inusuales de mercenarios en Harrow Dock.
> Varias Casas se mueven alrededor de Alexei Joric. Informad de cualquier contacto.
> The Collector no es solo para cobros locales. Mantenedla lista.
[IDENTIDAD DEL CONTACTO: OCULTA]`) + `<p class="dossier-muted">Descifrar el datapad protegido (Knowledge · Tech): DC 10 confirma informes regulares a un contacto Volkov; DC 15 recupera pagos, órdenes de vigilancia y referencias a Alexei; DC 20 recupera rutas y autenticación útiles como palanca futura.</p>`,
    terminal(`ENCRYPTED CHANNEL // CONTACT: <strong>BENEFACTOR V</strong>
> Weekly payment report transferred.
> Order: watch unusual mercenary movement in Harrow Dock.
> Several Houses are moving around Alexei Joric. Report any contact.
> The Collector is not for local collections only. Keep her ready.
[CONTACT IDENTITY: CONCEALED]`) + `<p class="dossier-muted">Decrypt the protected datapad (Knowledge · Tech): DC 10 confirms regular reporting to a Volkov contact; DC 15 recovers payment records, surveillance orders and references to Alexei; DC 20 recovers routing and authentication data usable as future leverage.</p>`),

  doc('dock_k17', 'Dock K-17: The Collector · Dock K-17: The Collector', 'Harrow Dock', 'Crossroads · Dock K-17',
    `<p><em>The Collector</em> espera en el centro del hangar, bajo una grúa móvil. Proa roma, tren de aterrizaje grueso y la postura de algo hecho para abrirse paso a empujones entre malas decisiones. Su casco fue rojo oscuro; años de reparaciones lo han cambiado por placas desparejadas, soldaduras a la vista y quemaduras. Una mandíbula blanca cruza la proa: alguien le puso demasiados dientes. Cuatro anclajes la sujetan en su cuna; líneas de combustible, refrigerante y energía entran en el casco. Una luz amarilla sale de la rampa de carga abierta.</p>
     <p>El altavoz exterior chisporrotea:</p>` + terminal('«LA VENTANA DE PAGO DE SEGURIDAD COMUNITARIA SE CIERRA EN VEINTISIETE MINUTOS.»') + `<p>Un operario de carga baja la mirada y sigue trabajando.</p>`,
    `<p><em>The Collector</em> waits in the centre of the hangar beneath a travelling crane. A blunt forward profile, thick landing gear, and the posture of something built to shoulder its way through bad decisions. Its hull was once dark red; years of repairs have replaced that colour with mismatched armor plates, exposed welds and scorching. A white jawbone stretches across the forward hull: someone added too many teeth. Four docking clamps hold the ship in its cradle; fuel, coolant and power lines run into the hull. Yellow utility light spills from the open loading ramp.</p>
     <p>The external speaker crackles:</p>` + terminal('“COMMUNITY SECURITY PAYMENT WINDOW CLOSES IN TWENTY-SEVEN MINUTES.”') + `<p>A loader operator lowers their eyes and keeps moving.</p>`),

  doc('subscriptions', 'Contabilidad de los Bone Dogs · Bone Dogs Ledger', 'Sistema contable de The Collector', 'Dock K-17',
    terminal(`CONCEPTO DE LOS COBROS DE EXTORSIÓN:
<strong>SUSCRIPCIONES DE SEGURIDAD COMUNITARIA</strong>
· Puesto de comida, nivel inferior ........ pagado
· Taller de reparaciones Jo ............... RETRASO
· Mercado del anillo 3 .................... embargado (mercancía a bordo)`),
    terminal(`EXTORTION PAYMENTS LISTED AS:
<strong>COMMUNITY SECURITY SUBSCRIPTIONS</strong>
· Food stall, lower level ................. paid
· Jo’s repair shop ........................ OVERDUE
· Ring 3 market ........................... seized (goods aboard)`)),

  doc('ratko_eye', 'El ojo de Ratko · Ratko’s Eye', 'Implante cibernético de Ratko', 'Dock K-17',
    sign('SUSCRIPCIÓN CADUCADA. RENUEVE AHORA PARA IDENTIFICACIÓN DE OBJETIVOS PREMIUM.'),
    sign('SUBSCRIPTION EXPIRED. RENEW NOW FOR PREMIUM TARGET IDENTIFICATION.')),

  doc('traffic', 'Control de tráfico de Charon’s Refuge · Charon Refuge Traffic Control', 'Respuesta automática', 'Tenebris Secundus',
    terminal(`- CONTROL DE TRÁFICO DE CHARON REFUGE -
SERVICIOS DE ATRAQUE DISPONIBLES.
BIENVENIDO, PERSONAL AUTORIZADO.
ESTADO ACTUAL DE LA ESTACIÓN: -
[la transmisión se corta · unos segundos después, otra voz]
POR FAVOR, MANTENGA LAS NORMAS SANITARIAS.
[canal cerrado · nadie contesta]`),
    terminal(`- CHARON REFUGE TRAFFIC CONTROL -
DOCKING SERVICES AVAILABLE.
WELCOME, AUTHORIZED PERSONNEL.
CURRENT STATION CONDITION: -
[the transmission breaks · seconds later, a different voice]
PLEASE MAINTAIN SANITARY STANDARDS.
[channel closed · no person answers]`)),

  doc('signs', 'Carteles y pintadas del anillo de atraque · Docking Ring Signs', 'Charon’s Refuge', 'Sector A',
    sign('MEJOR CAFÉ →') + `<p>Debajo, con otra letra:</p>` + sign('MENTIRA') +
    `<p>En Control de Atraque, en un bloc desechable, alguien empezó una nota de emergencia y se detuvo tras tres palabras. El bolígrafo sigue sujeto al tablero. No hay sangre.</p>` + sign('LOS ATRAE LA ENERGÍA -'),
    sign('BETTER COFFEE →') + `<p>Someone later added:</p>` + sign('LIAR') +
    `<p>In Docking Control, on a disposable pad, someone began an emergency note and stopped after three words. The pen is still attached to the board. There is no blood.</p>` + sign('THEY FOLLOW POWER -')),

  doc('arrival_log', 'Registro de llegadas · Arrival Log', 'Terminal de Control de Atraque', 'Charon’s Refuge · A3',
    terminal(`REGISTRO DE LLEGADAS (PARCIAL · DATOS CORRUPTOS)
1. IRON HEARTS — llegada hace tres días.
   Autorización de atraque comprada con una cuenta comercial independiente.
2. CONTRATISTA PRIVADO SIN IDENTIFICAR — llegada 18 horas después.
   Transpondedor y propiedad SELLADOS bajo privilegio comercial Valerius.
3. VARIAS SALIDAS AUTOMÁTICAS FALLIDAS.
   La estación intentó despachar naves que nunca despegaron.
4. PÉRDIDA DEL PERSONAL DE CONTROL DE TRÁFICO.
   Los registros de acceso del personal se interrumpen durante el segundo día.`) +
    `<p class="dossier-muted">Reconstruir los registros (Knowledge · Tech): DC 10 los Iron Hearts llegaron hace tres días; DC 15 una segunda nave llegó unas 18 horas después con privilegio Valerius; DC 20 la segunda nave usó un amarre oculto y su firma parcial puede vincularse luego a los Credit’s Whispers.</p>`,
    terminal(`ARRIVAL LOG (PARTIAL · DATA CORRUPTED)
1. IRON HEARTS — arrival three days ago.
   Docking authorization purchased through an independent commercial account.
2. UNIDENTIFIED PRIVATE CONTRACTOR — arrival eighteen hours later.
   Transponder and ownership data SEALED under Valerius commercial privilege.
3. SEVERAL FAILED AUTOMATED DEPARTURES.
   The station attempted to clear craft that never launched.
4. LOSS OF TRAFFIC-CONTROL PERSONNEL.
   Staff access records stop abruptly during the second day.`) +
    `<p class="dossier-muted">Reconstruct the traffic records (Knowledge · Tech): DC 10 the Iron Hearts arrived three days ago; DC 15 a second vessel arrived about eighteen hours later under sealed Valerius privilege; DC 20 it used a concealed berth and its partial signature can later be tied to the Credit’s Whispers.</p>`),

  doc('last_message', 'Último mensaje de Control de Atraque · Last Docking Message', 'Archivo de audio en cola', 'Charon’s Refuge · A3',
    audio(`«Control de Atraque a quien reciba. Hemos perdido Comercial y casi todo Residencial. Están dentro de los canales de energía. No activéis - »`, '[un golpe fuerte interrumpe la transmisión]', `«Apágalo. Pueden sentirlo.»`, '[fin de la grabación]'),
    audio(`“Docking Control to anyone receiving. We have lost Commercial and most of Residential. They are inside the power channels. Do not activate - ”`, '[a loud impact interrupts the transmission]', `“Turn it off. They can feel it.”`, '[the recording ends]')),

  doc('contractor_berth', 'Amarre oculto · Concealed Berth', 'Terminal público del anillo de atraque', 'Charon’s Refuge · A6',
    terminal(`AMARRE 7-C
CONTRATISTA PRIVADO DE RECUPERACIÓN
REGISTRO DE TRANSPONDEDOR SELLADO`) + `<p>La nave es más pequeña que la de los Iron Hearts, hecha para la velocidad y la discreción. Su casco absorbe casi toda la luz roja de la estación. Sin marcas de banda ni de Casa. Mantiene una energía interna mínima y un campo de vigilancia pasivo sobre el anillo.</p>`,
    terminal(`BERTH 7-C
PRIVATE RECOVERY CONTRACTOR
TRANSPONDER RECORD SEALED`) + `<p>The craft is smaller than the Iron Hearts’ vessel, shaped for speed and low visibility. Its surface absorbs most of the station’s red light. No gang markings or House identification. It maintains minimal internal power and a passive surveillance field watches the Docking Ring.</p>`),

  doc('signage', 'Señalización del cruce central · Junction Signage', 'Charon’s Refuge', 'Sector A',
    sign('MÉDICO - RECREO - CAMAROTES DE LA TRIPULACIÓN') + `<p>Hacia Ingeniería, la puerta principal fue sellada y después forzada desde el otro lado. Junto al marco, alguien ha pintado un pequeño corazón negro. Hacia los Laboratorios, la ruta pública está tras una mampara de seguridad agrietada; detrás, un rastro de lámparas de emergencia desconectadas baja hacia una oscuridad azul y fría.</p>`,
    sign('MEDICAL - RECREATION - CREW QUARTERS') + `<p>Toward Engineering, the main access door was sealed and later forced open from the far side. Someone has painted a small black heart beside the frame. Toward the Research Labs, the public route is locked behind a cracked glass security partition; behind it, a trail of disconnected emergency lamps descends into cold blue darkness.</p>`),

  doc('commercial', 'Notas del distrito comercial · Commercial District Notes', 'Charon’s Refuge', 'Sector B',
    `<p><strong>Cantina «Last Call», cartel de la puerta:</strong></p>` + sign('CALIENTE') +
    `<p><strong>Talleres de reparación, nota pegada a un dron:</strong></p>` + sign('NO ESTÁ MUERTO. SOLO SE HACE EL MUERTO.') +
    `<p>Un comunicador de corto alcance bajo el mostrador sigue sintonizado en un canal de supervivientes: casi todo es estática, respiraciones y fragmentos de avisos desde Ingeniería.</p>`,
    `<p><strong>Last Call cantina, door sign:</strong></p>` + sign('WARM') +
    `<p><strong>Repair workshops, note stuck to a drone:</strong></p>` + sign('NOT DEAD. JUST LYING.') +
    `<p>A short-range comm unit under the counter remains tuned to a survivor channel: mostly static, breathing, and fragments of warnings from Engineering.</p>`),

  doc('wrist_terminal', 'Terminal de muñeca abandonado · Discarded Wrist Terminal', 'Técnico desconocido', 'Charon’s Refuge · C1',
    terminal(`[PANTALLA DAÑADA · FRAGMENTO RECUPERADO]
LA ENERGÍA DEL LABORATORIO INFERIOR SIGUE ACTIVA. LOS PACKS SE MUEVEN.`) + `<p>Un uniforme de mantenimiento cuelga junto a un traje de presión que falta. El rastro del técnico lleva a una escotilla bajo el anillo residencial.</p>`,
    terminal(`[DISPLAY DAMAGED · FRAGMENT RECOVERED]
LOWER LAB POWER STILL ACTIVE. PACKS MOVING.`) + `<p>A maintenance uniform hangs beside a missing pressure suit. The technician’s trail leads to a maintenance hatch below the residential ring.</p>`),

  doc('rec_room', 'Sala de recreo · Recreation Room', 'Charon’s Refuge', 'Sector C · C3',
    `<p><strong>Pantalla de una máquina recreativa:</strong></p>` + terminal(`ÚLTIMA PARTIDA
INSERTE CRÉDITO
NO SE ADMITEN DEVOLUCIONES TRAS LA EVACUACIÓN`) +
    `<p><strong>Mensaje escrito a mano en la pizarra:</strong></p>` + sign('LAS COSAS DE ABAJO SE ESTÁN COMIENDO LOS PACKS DE RESERVA.<br>INGENIERÍA TIENE QUE SABERLO.<br>NO USÉIS LA PUERTA PRINCIPAL DE INVESTIGACIÓN.'),
    `<p><strong>Arcade machine screen:</strong></p>` + terminal(`LAST GAME
INSERT CREDIT
NO REFUNDS AFTER EVACUATION`) +
    `<p><strong>Handwritten on the board:</strong></p>` + sign('THE THINGS BELOW ARE EATING THE RESERVE PACKS.<br>ENGINEERING NEEDS TO KNOW.<br>DO NOT USE THE MAIN RESEARCH DOOR.')),

  doc('medical', 'Historiales médicos anómalos · Anomalous Medical Cases', 'Bahía médica', 'Charon’s Refuge · C4',
    terminal(`CASOS NEUROLÓGICOS — CONSULTA FILTRADA
· Varios pacientes con síntomas neurales tras contacto con un residuo translúcido.
· [DC 15] El caso más antiguo es ANTERIOR a la infestación visible.
· [DC 20] Ese paciente trabajaba en una sección de investigación Kurogane NO DECLARADA bajo la estación.`),
    terminal(`NEUROLOGICAL CASES — FILTERED QUERY
· Several patients show neural symptoms after exposure to a translucent residue.
· [DC 15] The oldest matching case PREDATES the visible infestation.
· [DC 20] That patient worked in an UNDECLARED Kurogane research section below the station.`)),

  doc('admin', 'Registros de administración · Station Administration Records', 'Administración de la estación', 'Charon’s Refuge · B5',
    terminal(`INFORMES DE ENERGÍA / ARCHIVO PÚBLICO
[DC 10] Consumo inexplicado bajo Acceso a Investigación.
[DC 15] Los planos públicos omiten varias salas y accesos verticales.
[DC 20] Referencias a proyectos vinculados a Kurogane: nivel de investigación oculto y almacenamiento de energía de emergencia profundo.
[DC 25] Código de la mampara de seguridad y ruta usada para bajar los packs de energía.`),
    terminal(`POWER REPORTS / PUBLIC ARCHIVE
[DC 10] Unexplained consumption below Research Access.
[DC 15] Public schematics omit several rooms and vertical access points.
[DC 20] Kurogane-linked project references: a concealed research level and deep emergency energy storage.
[DC 25] A security-partition code and the route once used to transfer power packs below.`)),

  doc('kurogane_archive', 'Archivo Kurogane · Kurogane Archive', 'Nodos de servidor', 'Charon’s Refuge · E2',
    terminal(`KUROGANE // ARCHIVO RECUPERADO (Knowledge · Tech)
[DC 10] Personal Kurogane asignado a una sección no declarada de «apoyo de subnivel».
[DC 15] Transferencias repetidas de equipos de almacenamiento de energía a esa sección.
[DC 20] Un sujeto biológico retenido recibía energía controlada: proyecto «estabilización del sustento».
[DC 25] El sujeto retenido es un ESPÉCIMEN WEAVER REPRODUCTOR. Cámara de transferencia de energía conectada a él: MARCADA.`) +
    `<p><strong>Registros experimentales (E4), anotación al margen:</strong></p>` + sign('LA PRIVACIÓN AUMENTA LA AGRESIVIDAD.<br>EL RECONOCIMIENTO PERMANECE.'),
    terminal(`KUROGANE // RECOVERED ARCHIVE (Knowledge · Tech)
[DC 10] Kurogane personnel assigned to an undeclared “sublevel support” section.
[DC 15] Portable power-storage equipment repeatedly transferred into that section.
[DC 20] A retained biological subject received controlled energy: project “sustenance stabilisation.”
[DC 25] The retained subject is a REPRODUCTIVE WEAVER SPECIMEN. Energy-transfer chamber connected to it: MARKED.`) +
    `<p><strong>Experimental records (E4), margin annotation:</strong></p>` + sign('DEPRIVATION INCREASES AGGRESSION.<br>RECOGNITION REMAINS.')),

  doc('queen_lair', 'La guarida de la Reina · The Queen’s Lair', 'Laboratorios Kurogane, sala 18', 'Charon’s Refuge · F10',
    `<p>La cámara es circular. Una luz azul y fría sube de los packs de energía apilados en el anillo exterior; algunos siguen en sus marcos de transporte, otros se han desmontado e incorporado al nido. Un crecimiento cristalino irradia desde el centro como los pétalos de una flor transparente. La Reina Weaver descansa dentro. Cada pack activo le envía una fina línea de luz. Weavers más pequeños van y vienen entre las reservas y el nido con la urgencia repetitiva de obreros que mantienen viva una colonia hambrienta.</p>`,
    `<p>The chamber is circular. Cold blue light rises from energy packs stacked around the outer ring; some remain secured in transport frames, others have been pulled apart and incorporated into the nest. Crystalline growth radiates from the centre like the petals of a transparent flower. The Weaver Queen rests within it. Every active pack feeds a thin line of light toward her. Smaller Weavers move between the reserves and the nest with the repetitive urgency of workers preserving a starving colony.</p>`),

  doc('pack', 'Pack de energía de reserva · Reserve Power Pack', 'Laboratorios Kurogane', 'Charon’s Refuge · Sector F',
    `<p>Un pack de energía portátil de la reserva de emergencia de la estación, todavía cargado: sus rejillas brillan con una luz azul y fría. El casco tiene zarpazos profundos y los conectores están cubiertos de un residuo translúcido y pegajoso. En los registros de alimentación del laboratorio, estos packs figuran como «sustento de emergencia».</p>
     <p class="dossier-muted">Moverlo es automático con equipo de carga, tiempo y una ruta segura; sin equipo o bajo presión, Strength CD 10 (CD 15 durante un ataque o una extracción precipitada).</p>`,
    `<p>A portable power pack from the station’s emergency reserve, still charged: its vents glow with a cold blue light. The casing carries deep claw marks and the connectors are coated in a sticky, translucent residue. In the lab’s feeding logs these packs appear as “emergency sustenance”.</p>
     <p class="dossier-muted">Moving one is automatic with lifting equipment, time and a secure route; without equipment or under pressure, Strength DC 10 (DC 15 during an attack or a rushed extraction).</p>`),

  doc('alexei_datapad', 'Datapad seguro de Alexei · Alexei’s Secured Datapad', 'Alexei Joric', 'Charon’s Refuge · Ingeniería',
    `<p>Autenticación Joric verificable (Knowledge DC 10). Contiene:</p><ul>
     <li>Correspondencia que prueba que Alexei <strong>organizó su propia desaparición</strong>.</li>
     <li>El acuerdo original con los Iron Hearts.</li>
     <li>Acceso a una reserva privada considerable destinada a pagarles.</li>
     <li>Fondos preparados para una vida nueva en el Borde.</li>
     <li>Varios poemas que no deberían considerarse prueba de nada salvo de sinceridad y de un criterio catastrófico.</li></ul>`,
    `<p>Verifiable Joric authentication (Knowledge DC 10). It contains:</p><ul>
     <li>Correspondence proving that Alexei <strong>arranged his own disappearance</strong>.</li>
     <li>The original agreement with the Iron Hearts.</li>
     <li>Access to a substantial private reserve intended to pay them.</li>
     <li>Funds prepared for a new life in the Rim.</li>
     <li>Several poems that should not be considered evidence of anything except sincerity and catastrophic judgment.</li></ul>`),

  doc('poetry', 'Poemas de Alexei · Alexei’s Poetry', 'Cuaderno de Alexei', 'Sin fecha',
    `<p><strong>Su obra actual: «Bulkheads of the Heart» (Mamparos del corazón).</strong> La primera estrofa compara el compromiso romántico con la integridad de presión. La segunda rima <em>nebula</em> con <em>spatula</em>. La tercera describe el entrelazamiento cuántico de forma tan inexacta que Thex se altera visiblemente: «Eso no es lo que significa entrelazamiento». «Es metafórico.» «La metáfora sigue siendo ofensiva en los hechos.»</p>
     <p>Entre las páginas, sujeto en el lomo, hay un chip de datos.</p>
     <blockquote><em>Tus ojos son como las estrellas de arriba,<br>pero más cerca, y con más… cosas.<br>Cuando contemplo tu rostro tan brillante,<br>siento sentimientos. Profundos. De noche.</em></blockquote>
     <blockquote><em>Oh, Zara, piloto de mi corazón,<br>se te da bien… lo de volar.<br>Por el Velo y la tormenta vas con valor,<br>te quiero más que… cosas. No sé qué más.</em></blockquote>
     <p class="dossier-muted">(Traducción libre: en el original rima todavía peor. Una vez rimó <em>nebula</em> con <em>spatula</em>.)</p>`,
    `<p><strong>His current work: “Bulkheads of the Heart”.</strong> The opening compares romantic commitment to pressure integrity. The second stanza rhymes <em>nebula</em> with <em>spatula</em>. The third describes quantum entanglement so inaccurately that Thex becomes visibly distressed: “That is not what entanglement means.” “It is metaphorical.” “The metaphor remains factually offensive.”</p>
     <p>Between the pages, held in the spine, there is a data chip.</p>
     <blockquote><em>Your eyes are like the stars above,<br>But closer, and with more… stuff.<br>When I gaze upon your face so bright,<br>I feel feelings. Deep feelings. At night.</em></blockquote>
     <blockquote><em>Oh Zara, pilot of my heart,<br>You are good at… the flying part.<br>Through Veil and storm you boldly go,<br>I love you more than… things. I do not know.</em></blockquote>`),

  doc('korren_comm', 'Comunicador de Korren · Korren’s Communicator', 'Canal cifrado · relé de la Casa Joric', 'Charon’s Refuge',
    terminal(`[23 MENSAJES SIN LEER · SINDICATO AURELIAN]
[CANAL ACTIVO · RELÉ CASA JORIC]
CONFIRME UBICACIÓN DEL OBJETIVO.
CONFIRME ESTADO DE LA NAVE.
LA CONSIDERACIÓN FINAL EXPIRA EN EL PRÓXIMO CICLO.`) +
    `<p class="dossier-muted">Interceptar la ráfaga (Knowledge · Tech): DC 15 la cabecera pertenece a un relé de la Casa Joric a menos de dos sistemas; DC 20 el paquete pide confirmar la ubicación de Alexei y el estado de la nave de los Iron Hearts, y un paquete de datos mayor sigue sin enviarse. Con Fear: Korren sabe que alguien vigila el canal.</p>`,
    terminal(`[23 UNREAD MESSAGES · AURELIAN SYNDICATE]
[ACTIVE CHANNEL · HOUSE JORIC RELAY]
CONFIRM TARGET LOCATION.
CONFIRM VESSEL STATUS.
FINAL CONSIDERATION EXPIRES AT NEXT CYCLE.`) +
    `<p class="dossier-muted">Intercept the burst signal (Knowledge · Tech): DC 15 the destination header belongs to a House Joric relay less than two systems away; DC 20 the packet requests confirmation of Alexei’s location and the Iron Hearts’ vessel status, and a larger data package remains unsent. With Fear: Korren knows someone is watching the channel.</p>`),

  doc('sterilize', 'Protocolo STERILIZE · Protocol STERILIZE', 'Voz de la estación', 'Charon’s Refuge · Ingeniería',
    audio('«Atención a todo el personal.»', '«Especímenes biológicos no autorizados detectados en el Sector Cuatro.»', '«Protocolo STERILIZE activado.»', '«Sellando todos los mamparos.»', '«Que tengan un día altamente productivo… y final.»'),
    audio('“Attention all personnel.”', '“Unsanctioned biological specimens detected in Sector Four.”', '“Protocol STERILIZE engaged.”', '“Sealing all bulkheads.”', '“Have a highly productive - and final - day.”')),

  doc('aria', 'ARIA-7, unidad de mantenimiento · ARIA-7, Caretaker Unit', 'ARIA-7', 'Charon’s Refuge',
    terminal(`«DESCARGA BIOLÓGICA NO AUTORIZADA.»
«ESTA ZONA FUE LIMPIADA HACE ONCE MINUTOS.»`),
    terminal(`“UNAUTHORIZED BIOLOGICAL DISCHARGE.”
“THIS AREA WAS SERVICED ELEVEN MINUTES AGO.”`)),

  doc('core_lost', 'Estabilidad del núcleo perdida · Core Stability Lost', 'Todas las pantallas de Ingeniería', 'Charon’s Refuge',
    sign('ESTABILIDAD DEL NÚCLEO PERDIDA') + `<p>Más allá de las puertas selladas, el metal se desgarra. El mapa de Charon’s Refuge empieza a perder pasillos enteros. La ruta al anillo de atraque sigue ahí. Por ahora.</p>`,
    sign('CORE STABILITY LOST') + `<p>Somewhere beyond the sealed doors, metal tears. The map of Charon’s Refuge begins losing entire corridors. The path to the Docking Ring is still present. For now.</p>`),
];
