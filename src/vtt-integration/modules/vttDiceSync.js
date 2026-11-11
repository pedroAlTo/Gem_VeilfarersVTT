import { getDatabase, ref, push, onChildAdded, query, limitToLast, serverTimestamp } from "firebase/database";
import { DualityResourceManager } from "./dualityResourceManager.js";

export class VTTDiceSync {
  constructor(roomId, currentUser, diceEngine) {
    try {
      this.db = getDatabase();
    } catch {
      this.db = null;
    }
    this.roomId = roomId;
    this.currentUser = currentUser;
    this.diceEngine = diceEngine;
    this.resourceManager = new DualityResourceManager();
    this.sessionJoinTime = Date.now();
  }

  listenToRoomRolls() {
    if (!this.db) return;
    const rollsRef = query(ref(this.db, `rooms/${this.roomId}/diceLog`), limitToLast(1));

    onChildAdded(rollsRef, async (snapshot) => {
      const rollData = snapshot.val();
      if (!rollData) return;

      if (rollData.clientTimestamp && rollData.clientTimestamp < this.sessionJoinTime) return;
      if (rollData.isSecret && this.currentUser.role !== 'keeper') return;

      // 1. Mostrar callout para clientes remotos (los dados 3D solo ruedan en el cliente que lanzó)
      if (rollData.uid !== this.currentUser.uid) {
        this.diceEngine.showCallout(rollData);
      }

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
    let hopeVal = 1;
    let fearVal = 1;
    let advVal = 0;

    const groups = [
      { qty: 1, sides: 12, theme: 'vfHope', role: 'hope' },
      { qty: 1, sides: 12, theme: 'vfFear', role: 'fear' }
    ];

    if (advantageDie !== 0) {
      groups.push({
        qty: 1,
        sides: 6,
        theme: 'vfNeutral',
        role: advantageDie > 0 ? 'advantage' : 'disadvantage'
      });
    }

    if (typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.roll === 'function') {
      try {
        const roll3d = await window.VFDice3D.roll(groups, {
          label: `${this.currentUser.displayName || 'Viajero'} · ${label}`,
          style: 'overlay',
          deferResults: true
        });

        if (roll3d && Array.isArray(roll3d.values) && roll3d.values.length >= 2) {
          hopeVal = roll3d.values[0];
          fearVal = roll3d.values[1];
          if (advantageDie !== 0 && roll3d.values.length >= 3) {
            advVal = roll3d.values[2] * Math.sign(advantageDie);
          }
        } else {
          hopeVal = Math.floor(Math.random() * 12) + 1;
          fearVal = Math.floor(Math.random() * 12) + 1;
          advVal = advantageDie ? (Math.floor(Math.random() * 6) + 1) * Math.sign(advantageDie) : 0;
        }
      } catch (err) {
        console.warn('[VTTDiceSync] Fallback a cálculo local:', err);
        hopeVal = Math.floor(Math.random() * 12) + 1;
        fearVal = Math.floor(Math.random() * 12) + 1;
        advVal = advantageDie ? (Math.floor(Math.random() * 6) + 1) * Math.sign(advantageDie) : 0;
      }
    } else {
      hopeVal = Math.floor(Math.random() * 12) + 1;
      fearVal = Math.floor(Math.random() * 12) + 1;
      advVal = advantageDie ? (Math.floor(Math.random() * 6) + 1) * Math.sign(advantageDie) : 0;
    }

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

    if (typeof window !== 'undefined' && window.VFDice3D && typeof window.VFDice3D.showResults === 'function') {
      window.VFDice3D.showResults({
        label: `${this.currentUser.displayName || 'Viajero'} · ${label}`,
        outcome: isCrit ? 'CRITICAL SUCCESS' : (fearVal > hopeVal ? 'WITH FEAR' : 'WITH HOPE'),
        hope: hopeVal,
        fear: fearVal,
        crit: isCrit,
        rolls: [
          { value: hopeVal, sides: 12, role: 'hope' },
          { value: fearVal, sides: 12, role: 'fear' }
        ],
        style: 'overlay'
      });
    }

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

    if (this.diceEngine && typeof this.diceEngine.showCallout === 'function') {
      this.diceEngine.showCallout(rollPayload);
    }

    if (this.db) {
      const rollsListRef = ref(this.db, `rooms/${this.roomId}/diceLog`);
      await push(rollsListRef, rollPayload);
    }
    return rollPayload;
  }

  async pushRollLog(payload) {
    if (!this.db) return;
    try {
      const rollsListRef = ref(this.db, `rooms/${this.roomId}/diceLog`);
      await push(rollsListRef, {
        type: 'duality',
        uid: this.currentUser?.uid || 'local',
        playerName: this.currentUser?.displayName || 'Operativo',
        clientTimestamp: Date.now(),
        serverTimestamp: serverTimestamp(),
        ...payload
      });
    } catch (e) {
      console.warn('[VTTDiceSync] Error pushing roll log:', e);
    }
  }
}