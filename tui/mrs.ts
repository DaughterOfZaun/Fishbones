import type { AbortOptions } from '@libp2p/interface'
import { button, form, label, list } from '../ui/remote/types'
import { console_log } from '../ui/remote/remote'
import { gsPkg } from '../utils/data/packages'
import { render } from '../ui/remote/view'

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace GitLab {
    export type MergeRequest = {
        iid: number
        title: string
        description: string
        reference: string
        author: {
            username: string
            name: string
        }
    }
}

export async function mrs(opts: Required<AbortOptions>){
    
    const view = render<number | null>('MergeRequests', form({
        Cancel: button(() => view.resolve(null)),
        NoMRs: { $type: 'base', visible: false },
        List: list(),
    }), opts, [
        {
            regex: /List\/(?<iid>\d+)\/Button:pressed/,
            listener(m){
                const iid = parseInt(m.groups!.iid!)
                view.resolve(iid)
            },
        }
    ])

    let mrs: GitLab.MergeRequest[] | undefined
    try {
        mrs = await (await fetch(gsPkg.gitLabMRs)).json() as never
    } catch(err) {
        console_log('Fetching a list of open requests failed:', Bun.inspect(err))
    }
    
    if(mrs && mrs.length > 0){
        view.get('List').setItems(
            Object.fromEntries(
                mrs.map(mr => {
                    const mrForm = form({
                        Button: button(),
                        Title: label(mr.title),
                        Info: label(`${mr.reference} · created by ${mr.author.name}`) //TODO: ${'20 hours ago'}
                    })
                    return [ mr.iid, mrForm ]
                })
            )
        )
    } else {
        view.update(form({
            Placeholder: { $type: 'base', visible: false },
            NoMRs: { $type: 'base', visible: true },
        }))
    }

    return view.promise
}
