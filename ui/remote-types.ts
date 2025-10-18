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
    button_pressed?: boolean
    $listeners?: {
        toggled?: (on: boolean) => void
    }
}

export interface Option extends Id {
    $type: 'option',
    options?: { id?: number, text?: string }[]
    $listeners?: {
        selected?: (index: number) => void
    }
}

export type Config = Form | List | Label | LineEdit | TextEdit | Button | Checkbox | Option

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

export const inq2gd = (choices: { value: number, name: string }[]) => choices.map(({ value: id, name: text }) => ({ id, text }))

export const form = (fields?: Record<string, Config>) => ({ $type: 'form' as const, fields })
export const list = (items?: Record<string, Config>) => ({ $type: 'list' as const, items })
export const label = (text?: string) => ({ $type: 'label' as const, text })
export const line = (text?: string, changed?: (text: string) => void) => ({ $type: 'line' as const, text, $listeners: { changed } })
export const checkbox = (button_pressed?: boolean, toggled?: (on: boolean) => void) => ({ $type: 'checkbox' as const, button_pressed, $listeners: { toggled } })
export const button = (pressed?: () => void, disabled = false) => ({ $type: 'button' as const, disabled, $listeners: { pressed } })
export const option = (options?: { id?: number, text?: string }[], selected?: number, item_selected?: (index: number) => void) => ({ $type: 'option' as const, selected, options, $listeners: { selected: item_selected } })

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
