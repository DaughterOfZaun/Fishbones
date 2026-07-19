export const TARGET = 'bun-windows-x64'
export const OUTDIR = 'dist'
export const NAME = 'Fishbones'
export const OUTFILE = `${NAME}.exe`
export const HIDE_CONSOLE = true
export const ICON = 'icon.ico'
export const VERSION_STRING = process.env.VERSION ?? '0.0.0.0'
export const TITLE = `${NAME} v${VERSION_STRING}`
export const PUBLISHER = "Jinx"
export const DESCRIPTION = "Yet another LeagueSandbox launcher with a twist"
export const COPYRIGHT = "AGPLv3"
export const VERSION_REGEX = /(\d+)\.(\d+)\.(\d+)\.(\d+)/
export const VERSION_NUMBER = versionFromString(VERSION_STRING)

export const HARDCODED_GH_RELEASE_URL = 'https://api.github.com/repos/DaughterOfZaun/Fishbones/releases'
export const HARDCODED_GH_DOWNLOAD_URL = 'https://github.com/DaughterOfZaun/Fishbones/releases/download/v0.0.4'

export const VERSION_FILE_DOMAIN = 'fishbones-version-file'
export const VERSION_FILE_CODEC = Uint8Array.from([ 0x50 ]) // Protocol Buffers
export const HARDCODED_UPGRADE_PUBLIC_KEY = 'IAOuTMg/ud6fE6id+R0sNsSfFIg9izQSLKInWYkcuYs='
export const HARDCODED_KEY_ENCODING = 'base64pad'

export const HARDCODED_SERVER_IP = '195.133.146.185'
export const HARDCODED_SERVER_PEER_ID = '12D3KooWHHyaqcTuPvphwifkP2su2Qis2wWKLZhaobc9cB5qXQak'
export const HARDCODED_SERVER_CERT_HASH = 'uEiBYh4UvCuTLl07oUNUl_1CNkWJAver2h7jLVdZmE0anig'
//export const HARDCODED_SERVER_IP = '127.0.0.1'
//export const HARDCODED_SERVER_PEER_ID = '12D3KooWQFGcVuhcCWY55qn4T6owriHz8f638p3oi4d5vM4xyq92'
//export const HARDCODED_SERVER_CERT_HASH = 'uEiAIMIG2b61Apk2Rx7UYDHG6l7Dj6iyXKWDk8FtlMqNc9Q'
export const HARDCODED_HTTP_SERVER_URL = `http://${HARDCODED_SERVER_IP}:3000`
export const HARDCODED_ANNOUNCE_URLS = [
    `udp://${HARDCODED_SERVER_IP}:6969/announce`,
    `http://${HARDCODED_SERVER_IP}:6969/announce`,
]

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

export function dateFromString(str: string){
    return new Date(str).getTime()
}

export function versionFromString(str: string){
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

export function versionToString(num: number){
    return [
        (num >> 8 * 3) & 0xFF,
        (num >> 8 * 2) & 0xFF,
        (num >> 8 * 1) & 0xFF,
        (num >> 8 * 0) & 0xFF,
    ].join('.')
}
