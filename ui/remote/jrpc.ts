export type JSONPrimitive = string | number | boolean | null | undefined
export type JSONValue = JSONPrimitive | JSONValue[] | JSONDict
export type JSONDict = { [key: string]: JSONValue }

type JRPCId = number
type JRPCMessage = JRPCResult | JRPCError | JRPCCall | JRPCNotification
interface JRPCResult { id: JRPCId, error: undefined, result: JSONValue }
interface JRPCError { id: JRPCId, error: { code: number, message: string }, result: undefined }
interface JRPCNotification { method: string, params?: JSONValue[] }
interface JRPCCall extends JRPCNotification { id: JRPCId }

let gid: JRPCId = 0
export function postIncGID(){
    return gid++
}

function stripDollarPrefixed(key: string, value: unknown){
    if(key.startsWith('$')) return undefined
    return value
}

export function sendCall(method: string, ...params: JSONValue[]){
    const id = gid++
    const json = JSON.stringify({ id, method, params }, stripDollarPrefixed)
    process.stdout.write(json + '\n', 'utf8')
    //console.log(json)
    return id
}
export function sendNotification(method: string, ...params: JSONValue[]){
    const json = JSON.stringify({ method, params }, stripDollarPrefixed)
    process.stdout.write(json + '\n', 'utf8')
    //console.log(json)
}
export function sendFollowupNotification(method: string, id: number, ...params: JSONValue[]){
    const json = JSON.stringify({ id, method, params }, stripDollarPrefixed)
    process.stdout.write(json + '\n', 'utf8')
    //console.log(json)
}

export function start(){
    process.stdin.addListener('data', onData)
}

export function stop(){
    sendNotification('exit')
    process.stdin.removeListener('data', onData)
}

export const listeners = new Map<JRPCId, (err?: { code?: number, message?: string }, result?: JSONValue) => void>()
export const handlers = new Map<JRPCId, Record<string, (...args: JSONValue[]) => void>>()

function onData(data: Buffer){
    const lines = data.toString('utf8').split('\n')
    for(let line of lines){
        line = line.trim()
        if(line.startsWith('{') && line.endsWith('}')){
            //logger.log(line)
            const obj = JSON.parse(line) as JRPCMessage

            if('id' in obj){
                const handler = handlers.get(obj.id)
                if(handler){
                    if('method' in obj){
                        handler[obj.method]?.(...(obj.params ?? []))
                    } else if(obj.error){
                        handler['reject']?.(obj.error)
                    } else {
                        handler['resolve']?.(obj.result)
                    }
                } else if('method' in obj){
                    //TODO: Global methods
                } else {
                    const listener = listeners.get(obj.id)
                    listener?.(obj.error, obj.result)
                }
            } else {
                //TODO: Notifications
            }
        }
    }
}
