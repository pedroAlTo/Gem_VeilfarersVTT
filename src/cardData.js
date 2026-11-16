// The rules data behind the card hand (Powers, Moves, Ancestries, Backgrounds). It is a large
// chunk, so it loads once in the background; game actions read it when it is there.
let data = null, loading = null;
export const cardData = () => data;
export const loadCardData = () => loading ||= import('./creator/creatorData.js').then(module => (data = module.CREATOR_DATA));
export const setCardData = value => { data = value; };
