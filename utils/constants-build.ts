export const TARGET = 'bun-windows-x64'
export const OUTDIR = 'dist'
export const NAME = 'Fishbones'
export const OUTFILE = `${NAME}.exe`
export const OUTFILE_CLI = `${NAME}-CLI.exe`
export const HIDE_CONSOLE = true
export const ICON = 'icon.ico'
export const VERSION = '0.0.3.0'
export const TITLE = `${NAME} v0.03`
export const PUBLISHER = "Jinx"
export const DESCRIPTION = "Yet another LeagueSandbox launcher with a twist"
export const COPYRIGHT = "AGPLv3"

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
