export interface Id {
    $id?: string
    visible?: boolean
}

export interface Form extends Id {
    $type: 'form'
    fields?: Record<string, Config>
}

export interface List extends Id {
    $type: 'list'
    placeholderText?: string
    items?: Record<string, Config>
}

export interface Label extends Id {
    $type: 'label'
    text?: string
}

export interface LineEdit extends Id {
    $type: 'line'
    text?: string
    disabled?: boolean
    $listeners?: {
        changed?: (text: string) => void
    }
}

export interface TextEdit extends Id {
    $type: 'text'
    text?: string
    disabled?: boolean
    $listeners?: {
        changed?: (text: string) => void
    }
}

export interface Button extends Id {
    $type: 'button'
    disabled?: boolean
    $listeners?: {
        pressed?: () => void
    }
}

export interface Checkbox extends Id {
    $type: 'checkbox'
    disabled?: boolean
    button_pressed: boolean
    $listeners?: {
        toggled?: (on: boolean) => void
    }
}

export type Config = Form | List | Label | LineEdit | TextEdit | Button | Checkbox

export interface View {
    //path: string
    get(path: string): View
    //call(name: string, args: JSONValue[]): void
    //// eslint-disable-next-line @typescript-eslint/no-explicit-any
    //on(event: string, callback: (...args: any[]) => void): void
    //off(event: string): void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function render(name: string, config: Config){ return undefined! as View }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function typeTest(){
    const view = render('TestContainer', {
        $type: 'form',
        fields: {
            input: {
                $type: 'line',
                text: '',
            },
            enter: {
                $type: 'button',
                $listeners: {
                    'pressed': () => {}
                }
            }
        }
    })
    return view
}
