import { SubProcess } from "teen_process"
import { gcPkg } from "./data-packages"
import { sanitize_bfkey } from "./constants"
import { killSubprocess } from "./data-shared"

let launchArgs: undefined | Parameters<typeof launchClient>
let clientSubprocess: undefined | SubProcess
export async function launchClient(ip: string, port: number, key: string, clientId: number){
    launchArgs = [ip, port, key, clientId]
    return await relaunchClient()
}
export async function relaunchClient(){
    const [ip, port, key, clientId] = launchArgs!

    const gcArgs = ['', '', '', ([ip, port.toString(), sanitize_bfkey(key), clientId.toString()]).join(' ')].map(a => `"${a}"`).join(' ')
    
    await stopClient()

    if(process.platform == 'win32')
        clientSubprocess = new SubProcess(gcPkg.exe, [ gcArgs ])
    else if(process.platform == 'linux')
        clientSubprocess = new SubProcess('bottles-cli', ['run', '-b', 'Default Gaming', '-e', gcPkg.exe, gcArgs])
        //clientSubprocess = new SubProcess('bottles-cli', ['run', '-b', 'Default Gaming', '-p', 'League of Legends', '--args-replace', gcArgs])
    else throw new Error(`Unsupported platform: ${process.platform}`)

    console.log(clientSubprocess.rep)

    await clientSubprocess.start()
    return clientSubprocess
}

export async function stopClient(){
    const prevSubprocess = clientSubprocess!

    if(!clientSubprocess) return
    clientSubprocess = undefined

    await killSubprocess(prevSubprocess)
}