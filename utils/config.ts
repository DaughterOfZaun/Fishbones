import type { AbortOptions } from '@libp2p/interface'
import { downloads, fs_readFile, fs_writeFile } from './data/fs'
import { AUTO_LOCALE, setUsedLocale } from './translation'
import { gsPkg } from './data/packages'
import path from 'node:path'

export const REMOTE_IDX = 'game-server-git-remote-index'
export const LOCALE_STR = 'locale'

type Config = typeof defaultConfig
const defaultConfig = {
    [REMOTE_IDX]: 0,
    [LOCALE_STR]: AUTO_LOCALE,
}

export let config = Object.assign({}, defaultConfig)
export async function loadConfig(opts: Required<AbortOptions>){
    let configJSON: string | undefined
    await fs_readFile(configFile, { ...opts, encoding: 'utf8' })
    if(configJSON){
        config = JSON.parse(configJSON) as Config
    } else {
        await saveConfig(defaultConfig, opts)
    }

    gsPkg.setRemoteByIndex(config[REMOTE_IDX])
    //setUsedLocale(config[LOCALE_STR])

    return config
}

const configFile = path.join(downloads, 'config.json')
export async function saveConfig(config: Config, opts: Required<AbortOptions>){
    return fs_writeFile(configFile, JSON.stringify(config, null, 4), { ...opts, encoding: 'utf8' })
}