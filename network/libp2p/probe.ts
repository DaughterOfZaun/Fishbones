import { TypedEventEmitter, type PeerId, type Startable } from "@libp2p/interface";
import { udpSocket } from "bun";

interface ProbeInit {}
interface ProbeEvents {}
interface ProbeComponents {}

export function probe(init: ProbeInit = {}): (components: ProbeComponents) => Probe {
  return (components) => new Probe(init, components)
}

class Peer {
    constructor(
        public readonly id: number,
        public readonly peerId: PeerId,
        public readonly connections = new Map<number, Connection>(),
    ){}
}
class Connection {
    constructor(
        public readonly id: number,
        public readonly addr: string,
        public readonly state: State,
    ){}
}
enum State {
    Opening,
    Keeping,
    GivingUp,
}

class Message {
    constructor(
        public readonly peerId: number,
        public readonly connId: number,
        public readonly action: Action,
    ){}
}
enum Action {
    None = 0,
    Request = 1,
    Response = 2,
    Confirmation = 3,
}

class Probe extends TypedEventEmitter<ProbeEvents> implements Startable {
    
    private socket: Bun.udp.Socket<'buffer'> | null = null
    private readonly peers = new Map<number, Peer>()

    constructor(
        private readonly init: ProbeInit,
        private readonly components: ProbeComponents,
    ){
        super()
    }

    async start(){
        this.socket = await udpSocket<'buffer'>({
            hostname: '0.0.0.0',
            port: 0,
            socket: {
                //drain(socket){},
                //error(socket, error){},
                data(socket, data, port, address, flags){
                    
                },
            }
        })
    }
    stop(){
        this.socket?.close()
        this.socket = null
    }
}
