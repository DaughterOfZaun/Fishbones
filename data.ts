import { getServerSettings, launchServer, stopServer } from './utils/data-server'
import { launchClient, relaunchClient, stopClient } from './utils/data-client'
import { stopAria2 } from './utils/data-download'
import { repair } from './utils/data-repair'
import { getAnnounceAddrs } from './utils/data-trackers'

export { stopServer, stopClient, launchServer, launchClient, relaunchClient, repair, getAnnounceAddrs, getServerSettings }

export async function stop(){
    stopServer()
    stopClient()
    stopAria2()
}
