import { EventEmitter as TypedEventEmitter } from 'node:events'
export { TypedEventEmitter }

/*
export class TypedEventEmitter<Events> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    on<K extends keyof Events>(arg0: K, arg1: (arg: Events[K]) => void) {
        //throw new Error('Method not implemented.')
        return this
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    once<K extends keyof Events>(arg0: K, arg1: (arg: Events[K]) => void) {
        //throw new Error('Method not implemented.')
        return this
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    emit<K extends keyof Events>(arg0: K, arg1: Events[K]) {
        throw new Error('Method not implemented.')
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    removeListener<K extends keyof Events>(arg0: K, arg1: (arg: Events[K]) => void) {
        throw new Error('Method not implemented.')
    }
}
*/