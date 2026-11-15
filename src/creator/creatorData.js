// Rules data of the character creator (the VTT's own copy). Imported on demand so it
// stays out of the main bundle.
import ancestries from './data/ancestries.json' with { type: 'json' };
import communities from './data/communities.json' with { type: 'json' };
import classes from './data/classes.json' with { type: 'json' };
import affiliations from './data/affiliations.json' with { type: 'json' };
import powers from './data/powers.json' with { type: 'json' };
import weapons from './data/weapons.json' with { type: 'json' };
import armor from './data/armor.json' with { type: 'json' };

export const CREATOR_DATA = Object.freeze({ ancestries, communities, classes, affiliations, powers, weapons, armor });
