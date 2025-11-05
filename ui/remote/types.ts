export interface Id {
    $id?: string
    visible?: boolean
    tooltip_text?: string
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
    icon?: string
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
    disabled?: boolean
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

export const inq2gd = (choices: { value: number, name: string }[], enabled?: number[]) => {
    return choices
        .filter(({ value: id }) => !enabled || enabled.includes(id))
        .map(({ value: id, name: text }) => ({ id, text }))
}

export const form = (fields?: Record<string, Config>) => ({ $type: 'form' as const, fields })
export const list = (items?: Record<string, Config>, placeholderText?: string) => ({ $type: 'list' as const, items, placeholderText })
export const label = (text?: string) => ({ $type: 'label' as const, text })
export const line = (text?: string, changed?: (text: string) => void) => ({ $type: 'line' as const, text, $listeners: { changed } })
export const text = (text?: string, changed?: (text: string) => void) => ({ $type: 'text' as const, text, $listeners: { changed } })
export const checkbox = (button_pressed?: boolean, toggled?: (on: boolean) => void) => ({ $type: 'checkbox' as const, button_pressed, $listeners: { toggled } })
export const button = (pressed?: () => void, disabled?: boolean) => ({ $type: 'button' as const, disabled, $listeners: { pressed } })
export const option = (options?: { id?: number, text?: string }[], selected?: number, item_selected?: (index: number) => void, disabled?: boolean) => ({ $type: 'option' as const, disabled, selected, options, $listeners: { selected: item_selected } })
export const icon = (icon?: string, placeholderText?: string, disabled?: boolean) => ({
    $type: 'button' as const,
    text: (!icon) ? placeholderText : undefined,
    tooltip_text: (icon) ? placeholderText : undefined,
    disabled,
    icon,
})

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
