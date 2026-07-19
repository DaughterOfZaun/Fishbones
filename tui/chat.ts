import { TypedEventEmitter, type AbortOptions } from "@libp2p/interface";
import { type DeferredView, render } from "../ui/remote/view";
import type { ChatEventDetail, Game } from "../game/game";
import { getCustomUsername, getName } from "../utils/namegen/namegen";
import { form, line, text } from "../ui/remote/types";
import type { GamePlayer } from "../game/game-player";
import { tr } from "../utils/translation";

type ChatEvents = {
    line: CustomEvent<string>
}

class Chat extends TypedEventEmitter<ChatEvents> {

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

    private lines: string[] = []
    private append(message: string){
        const lastMessage = this.lines.at(-1)!
        if(lastMessage == message){
            return
        }
        this.lines.push(message)
        this.view.get('Text').update(text(this.lines.join('\n')))
    }

    private game: Game | undefined

    public bind(game: Game){
        this.game = game
        game.addEventListener('joined', this.onJoined)
        game.addEventListener('chat', this.onChat)
        chat.addEventListener('line', this.onLine)

        this.view.show()
    }

    public unbind(){
        const game = this.game!
        game.removeEventListener('joined', this.onJoined)
        game.removeEventListener('chat', this.onChat)
        chat.removeEventListener('line', this.onLine)
        this.game = undefined

        this.view.hide()
        this.lines.length = 0
        this.view.update(form({
            Text: text(''),
            Line: line(''),
        }))
    }

    private readonly onJoined = (event: CustomEvent<GamePlayer>) => {
        const player = event.detail
        //const isMe = game.getPlayer() === player
        //const name = getName(player, isMe, true)
        const name = getCustomUsername(player, undefined, true)
        chat.append((`[color=gray]${tr(`{name} joined the lobby`, { name })}[/color]`))
    }

    private readonly onChat = (event: CustomEvent<ChatEventDetail>) => {
        const { player, message } = event.detail
        //const isMe = game.getPlayer() === player
        //const name = getName(player, isMe, true)
        const name = getCustomUsername(player, undefined, true)
        chat.append(`${name}: ${message}`)
    }

    private readonly onLine = (event: CustomEvent<string>) => {
        const line = event.detail
        const game = this.game!
        game.appendToChat(line)
    }
}

export const chat = new Chat()
