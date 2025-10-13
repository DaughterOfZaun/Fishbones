import type { JSONValue } from "./remote-jrpc"

export interface Id {
    $id?: string
}

export interface Form extends Id {
    $type: 'form'
    fields: Record<string, Control>
}

export interface List extends Id {
    $type: 'list'
    items?: Record<string, Control>
}

export interface Label extends Id {
    $type: 'label'
    text?: string
}

export interface LineEdit extends Id {
    $type: 'line'
    text?: string
    $listeners?: {
        change?: (arg1: string) => void
    }
}

export interface TextEdit extends Id {
    $type: 'text'
    text?: string
    $listeners?: {
        change?: (arg1: string) => void
    }
}

export interface Button extends Id {
    $type: 'button'
    $listeners?: {
        pressed?: () => void
    }
}

export type Control = Form | List | Label | LineEdit | TextEdit | Button

export interface View {
    //path: string
    get(path: string): View
    call(name: string, args: JSONValue[]): void
    //on(event: string, callback: () => void): void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function render(name: string, control: Control){ return undefined! as View }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function typeTest(){
    const view = render('TestContainer', {
        $type: 'form',
        fields: {
            'input': {
                $type: 'line',
                text: '',
            },
            'enter': {
                $type: 'button',
                $listeners: {
                    'pressed': () => {}
                }
            }
        }
    })
    return view
}
