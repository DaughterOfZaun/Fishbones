import { TypedEventEmitter, type AbortOptions } from "@libp2p/interface";
import { type DeferredView, render } from "../ui/remote/view";
import type { Deferred } from "../utils/process/process";
import type { ChatEventDetail, Game } from "../game/game";
import { getName } from "../utils/namegen/namegen";
import { form, line, text } from "../ui/remote/types";
import type { GamePlayer } from "../game/game-player";

type ChatEvents = {
    line: CustomEvent<string>
}

export const chat = new class Chat extends TypedEventEmitter<ChatEvents> {

    private view!: DeferredView<void>
    public prerender(opts: Required<AbortOptions>){
        this.view = render('Chat', form({
            Text: text(''),
            Line: {
                $type: 'line',
                text: '',
                $listeners: {
                    submitted: (message) => {
                        this.view.get('Line').update(line(''))
                        this.safeDispatchEvent('line', { detail: message })
                    }
                }
            }
        }), opts, [], true)
    }

    private show(){
        this.view.show()
    }
    private hide(){
        this.view.hide()
        this.lines.length = 0
        this.view.update(form({
            Text: text(''),
            Line: line(''),
        }))
    }

    private lines: string[] = []
    private append(message: string){
        this.lines.push(message)
        this.view.get('Text').update(text(this.lines.join('\n')))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public bind(view: Deferred<any>, game: Game){
        view.addEventListener(game, 'joined', (event: CustomEvent<GamePlayer>) => {
            const player = event.detail
            const isMe = game.getPlayer() === player
            const name = getName(player, isMe)
            chat.append(`[color=gray]${name} joined the lobby[/color]`)
        })
        view.addEventListener(game, 'chat', (event: CustomEvent<ChatEventDetail>) => {
            const { player, message } = event.detail
            const isMe = game.getPlayer() === player
            const name = getName(player, isMe)
            chat.append(`${name}: ${message}`)
        })
        view.addEventListener(chat, 'line', (event: CustomEvent<string>) => {
            const line = event.detail
            game.appendToChat(line)
        })
        view.addCleanupCallback(() => {
            chat.hide()
        })
        chat.show()
    }
}
