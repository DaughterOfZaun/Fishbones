export const TARGET = 'bun-windows-x64'
export const OUTDIR = 'dist'
export const NAME = 'Fishbones'
export const OUTFILE = `${NAME}.exe`
export const HIDE_CONSOLE = true
export const ICON = 'icon.ico'
export const VERSION = process.env.VERSION!
export const TITLE = `${NAME} v${VERSION}`
export const PUBLISHER = "Jinx"
export const DESCRIPTION = "Yet another LeagueSandbox launcher with a twist"
export const COPYRIGHT = "AGPLv3"
export const VERSION_REGEX = /(\d+)\.(\d+)\.(\d+)\.(\d+)/

const discoveryTopic = '_peer-discovery._p2p._pubsub'
const appName = ['com', 'github', 'DaughterOfZaun', 'Fishbones']
export const appDiscoveryTopic = `${appName.join('.')}.${discoveryTopic}`

export const rtcConfiguration = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:global.stun.twilio.com:3478',
                'stun:stun.cloudflare.com:3478',
                'stun:stun.services.mozilla.com:3478',
            ],
        },
    ],
}

export const arch = 'x64' //TODO:
export const platform =
    process.platform === 'win32' ? 'Windows' :
    process.platform === 'linux' ? 'Linux' :
    undefined!

export const date = (str: string) => new Date(str).getTime()
export const versionFromString = (str: string) => {
    const m = str.match(VERSION_REGEX)
    if(m){
        return 0
            | parseInt(m[4]!) << 8 * 0
            | parseInt(m[3]!) << 8 * 1
            | parseInt(m[2]!) << 8 * 2
            | parseInt(m[1]!) << 8 * 3
    }
    return 0
}

export const versionToString = (num: number) => {
    return [
        (num >> 8 * 3) & 0xFF,
        (num >> 8 * 2) & 0xFF,
        (num >> 8 * 1) & 0xFF,
        (num >> 8 * 0) & 0xFF,
    ].join('.')
}
