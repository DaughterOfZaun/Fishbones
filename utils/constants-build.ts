export const TARGET = 'bun-windows-x64'
export const OUTDIR = 'dist'
export const NAME = 'Fishbones'
export const OUTFILE = `${NAME}.exe`
export const OUTFILE_JS = `${NAME}.js`
export const OUTFILE_CLI = `${NAME}-CLI.exe`
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
                'stun:global.stun.twilio.com:3478'
            ],
        },
    ],
}
