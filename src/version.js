import metadata from '../package.json' with { type: 'json' };

export const APP_VERSION = metadata.version;
export const APP_LABEL = `VeilFarers VTT v${APP_VERSION}`;
export const RELEASE_BASENAME = `VeilFarers_VTT_v${APP_VERSION}`;
export const CHANGELOG_FILENAME = `VeilFarers_VTT_Changelog_v${APP_VERSION}.md`;
