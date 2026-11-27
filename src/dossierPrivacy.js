// The «Solo para Keeper» part of a dossier (v2.63.0, user request: «en dossier pon dos campos: el que
// hay ahora y Solo para Keeper, que no se comparte cuando se envía el dossier»). Whatever reaches a
// player (the room snapshot, a transmission) goes through here and loses it.
export const publicDossier = doc => {
  const { keeperHtml, ...shared } = doc;
  return shared;
};
