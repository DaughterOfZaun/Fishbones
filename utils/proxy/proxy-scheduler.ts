import Queue from 'yocto-queue'

type Task = {
    time: number
    callback: (...args: unknown[]) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any[]
}
export type TimeSource = { now(): number }
export class Scheduler {
    
    private interval: ReturnType<typeof setInterval> | undefined
    private queue = new Queue<Task>()

    constructor(
        private readonly timeSource: TimeSource,
    ){}

    public stop(){
        clearInterval(this.interval)
        this.interval = undefined
        this.queue.clear()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public enqueue<T extends (...args: any[]) => void>(time: number, callback: T, ...args: Parameters<T>){
        if(time <= this.timeSource.now()){
            callback(...args)
            return
        }
        const task = { time, callback, args }
        this.queue.enqueue(task)
        if(!this.interval){
            this.interval = setInterval(this.onInterval, 1)
        }
    }
    private onInterval = () => {
        while(this.interval){
            const task = this.queue.peek()
            if(!task){
                clearInterval(this.interval)
                this.interval = undefined
                break
            }
            if(task.time <= this.timeSource.now()){
                task.callback.apply(null, task.args)
                this.queue.dequeue()
                continue
            }
            break
        }
    }
}
