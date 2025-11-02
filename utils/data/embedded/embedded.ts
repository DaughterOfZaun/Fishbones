import type { config } from './config'

////@ts-expect-error: Cannot find module or its corresponding type declarations.
import embeddedJson from '../../../dist/embedded.json'

import { default as trackersTxt } from '../../../Fishbones_Data/trackers.txt' with { type: 'file' }

type ConfigKeys = keyof typeof config
export default {
    ...(embeddedJson as Record<ConfigKeys, string>),
    trackersTxt,
}