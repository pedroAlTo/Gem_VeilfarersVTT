import { getDatabase, ref, push, onChildAdded, query, limitToLast, serverTimestamp } from "firebase/database";
import { DualityResourceManager } from "./dualityResourceManager.js";

export class VTTDiceSync {
  constructor(roomId, currentUser, diceEngine) {
    this.db = getDatabase();
    this.roomId = roomId;
    this.currentUser = currentUser;
    this.diceEngine = diceEngine;
    this.resourceManager = new DualityResourceManager();
    this.sessionJoinTime = Date.now();
  }

  listenToRoomRolls() {
    const rollsRef = query(ref(this.db, `rooms/${this.roomId}/diceLog`), limitToLast(1));

    onChildAdded(rollsRef, async (snapshot) => {
      const rollData = snapshot.val();
      if (!rollData) return;

      if (rollData.clientTimestamp && rollData.clientTimestamp < this.sessionJoinTime) return;
      if (rollData.isSecret && this.currentUser.role !== 'keeper') return;

      // 1. Reproducir animación de dados 3D
      await this.diceEngine.playRollAnimation(rollData);

      // 2. Transacción de recursos ejecutada únicamente por el cliente que lanzó
      if (rollData.uid === this.currentUser.uid && rollData.type === 'duality' && !rollData.skipAutoResource) {
        const changes = await this.resourceManager.applyRollOutcome({
          roomId: this.roomId,
          charId: rollData.charId,
          outcomeType: rollData.outcomeType
        });

        this.diceEngine.showResourceFeedback(changes, async () => {
          await this.resourceManager.revertOutcome({
            roomId: this.roomId,
            charId: rollData.charId,
            changesApplied: changes
          });
        });
      }
    });
  }

  async rollDuality({ label = "Acción", modifier = 0, advantageDie = 0, charId = null }) {
    const hopeVal = Math.floor(Math.random() * 12) + 1;
    const fearVal = Math.floor(Math.random() * 12) + 1;
    const advVal = advantageDie ? (Math.floor(Math.random() * 6) + 1) * Math.sign(advantageDie) : 0;

    const isCrit = hopeVal === fearVal;
    const total = hopeVal + fearVal + modifier + advVal;

    let outcomeType = 'hope';
    let outcomeLabel = 'CON HOPE';

    if (isCrit) {
      outcomeType = 'crit';
      outcomeLabel = '¡ÉXITO CRÍTICO!';
    } else if (fearVal > hopeVal) {
      outcomeType = 'fear';
      outcomeLabel = 'CON FEAR';
    }

    const modText = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    const advText = advVal !== 0 ? ` | Vent/Desv (${advVal > 0 ? '+' + advVal : advVal})` : '';

    const rollPayload = {
      type: 'duality',
      uid: this.currentUser.uid,
      playerName: this.currentUser.displayName || 'Viajero',
      charId: charId,
      label: label,
      hopeVal: hopeVal,
      fearVal: fearVal,
      modifier: modifier,
      advVal: advVal,
      total: total,
      outcomeType: outcomeType,
      outcomeLabel: outcomeLabel,
      breakdown: `Hope [${hopeVal}] + Fear [${fearVal}] ${modText}${advText}`,
      isSecret: false,
      clientTimestamp: Date.now(),
      serverTimestamp: serverTimestamp()
    };

    const rollsListRef = ref(this.db, `rooms/${this.roomId}/diceLog`);
    await push(rollsListRef, rollPayload);
    return rollPayload;
  }
}