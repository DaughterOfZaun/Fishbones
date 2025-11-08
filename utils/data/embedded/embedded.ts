import type { config } from './config'
import embeddedJson from '../../../dist/embedded.json'

type ConfigKeys = keyof typeof config
export default {
    ...(embeddedJson as Record<ConfigKeys, string>),
}