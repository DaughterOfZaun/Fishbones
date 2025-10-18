import type { Game } from "./game";
import { form, list } from "./ui/remote-types";
import { render } from "./ui/remote-view";

interface Context {
    signal: AbortSignal,
    controller: AbortController,
    game: Game,
}

export async function lobby_pick(ctx: Context){

    const team = () => {}

    const view = render('ChampionSelect', form({
        Team1: list(),
    }), ctx)
    return view.promise
}