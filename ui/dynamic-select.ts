import {
    createPrompt,
    useState,
    useKeypress,
    usePrefix,
    usePagination,
    useRef,
    useMemo,
    useEffect,
    isBackspaceKey,
    isEnterKey,
    isUpKey,
    isDownKey,
    isNumberKey,
    Separator,
    ValidationError,
    makeTheme,
    type Theme,
    type Status,
} from '@inquirer/core';
import type { PartialDeep } from '@inquirer/type';
import colors from 'yoctocolors-cjs';
import figures from '@inquirer/figures';
import ansiEscapes from 'ansi-escapes';
import { useCallback } from './use-callback';

type SelectTheme = {
    icon: { cursor: string };
    style: {
        disabled: (text: string) => string;
        description: (text: string) => string;
    };
    helpMode: 'always' | 'never' | 'auto';
    indexMode: 'hidden' | 'number';
};

const selectTheme: SelectTheme = {
    icon: { cursor: figures.pointer },
    style: {
        disabled: (text: string) => colors.dim(`- ${text}`),
        description: (text: string) => colors.cyan(text),
    },
    helpMode: 'auto',
    indexMode: 'hidden',
};

type Choice<Value> = {
    value: Value;
    name?: string;
    description?: string;
    short?: string;
    disabled?: boolean | string;
    type?: never;
};

type NormalizedChoice<Value> = {
    value: Value;
    name: string;
    description?: string;
    short: string;
    disabled: boolean | string;
};

type SelectConfig<
    Value,
    ChoicesObject = ReadonlyArray<string | Choice<Value> | Separator>,
> = {
    message: string;
    choices: ChoicesObject;
    pageSize?: number;
    loop?: boolean;
    default?: unknown;
    instructions?: {
        navigation: string;
        pager: string;
    };
    theme?: PartialDeep<Theme<SelectTheme>>;
    cb?: (setItems: (choices: ChoicesObject) => void) => () => void
};

function isSelectable<Value>(
    item: NormalizedChoice<Value> | Separator,
): item is NormalizedChoice<Value> {
    return !Separator.isSeparator(item) && !item.disabled;
}

function normalizeChoices<Value>(
    choices: ReadonlyArray<string | Choice<Value> | Separator>,
): Array<NormalizedChoice<Value> | Separator> {
    return choices.map((choice) => {
        if (Separator.isSeparator(choice)) return choice;

        if (typeof choice === 'string') {
            return {
                value: choice as Value,
                name: choice,
                short: choice,
                disabled: false,
            };
        }

        const name = choice.name ?? String(choice.value);
        const normalizedChoice: NormalizedChoice<Value> = {
            value: choice.value,
            name,
            short: choice.short ?? name,
            disabled: choice.disabled ?? false,
        };

        if (choice.description) {
            normalizedChoice.description = choice.description;
        }

        return normalizedChoice;
    });
}

export default createPrompt(
    <Value>(config: SelectConfig<Value>, done: (value: Value) => void) => {
        const { loop = true, pageSize = 7 } = config;
        const firstRender = useRef(true);
        const theme = makeTheme<SelectTheme>(selectTheme, config.theme);
        const [status, setStatus] = useState<Status>('idle');
        const prefix = usePrefix({ status, theme });
        const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
        
        //const items = useMemo(() => normalizeChoices(config.choices), [config.choices]);
        const [items, setItems] = useState(() => normalizeChoices(config.choices))
        if(config.cb) useCallback(config.cb, choices => {
            setItems(normalizeChoices(choices))
            setActive(Math.min(Math.max(0, active), choices.length - 1))
        })

        const bounds = useMemo(() => {
            const first = items.findIndex(isSelectable);
            const last = items.findLastIndex(isSelectable);

            if (first === -1) {
                throw new ValidationError(
                    '[select prompt] No selectable choices. All choices are disabled.',
                );
            }

            return { first, last };
        }, [items]);

        const defaultItemIndex = useMemo(() => {
            if (!('default' in config)) return -1;
            return items.findIndex(
                (item) => isSelectable(item) && item.value === config.default,
            );
        }, [config.default, items]);

        const [active, setActive] = useState(
            defaultItemIndex === -1 ? bounds.first : defaultItemIndex,
        );

        // Safe to assume the cursor position always point to a Choice.
        const selectedChoice = items[active] as NormalizedChoice<Value>;

        useKeypress((key, rl) => {
            clearTimeout(searchTimeoutRef.current);

            if (isEnterKey(key)) {
                setStatus('done');
                done(selectedChoice.value);
            } else if (isUpKey(key) || isDownKey(key)) {
                rl.clearLine(0);
                if (
                    loop ||
                    (isUpKey(key) && active !== bounds.first) ||
                    (isDownKey(key) && active !== bounds.last)
                ) {
                    const offset = isUpKey(key) ? -1 : 1;
                    let next = active;
                    do {
                        next = (next + offset + items.length) % items.length;
                    } while (!isSelectable(items[next]!));
                    setActive(next);
                }
            } else if (isNumberKey(key) && !Number.isNaN(Number(rl.line))) {
                const position = Number(rl.line) - 1;
                const item = items[position];
                if (item != null && isSelectable(item)) {
                    setActive(position);
                }

                searchTimeoutRef.current = setTimeout(() => {
                    rl.clearLine(0);
                }, 700);
            } else if (isBackspaceKey(key)) {
                rl.clearLine(0);
            } else {
                // Default to search
                const searchTerm = rl.line.toLowerCase();
                const matchIndex = items.findIndex((item) => {
                    if (Separator.isSeparator(item) || !isSelectable(item)) return false;

                    return item.name.toLowerCase().startsWith(searchTerm);
                });

                if (matchIndex !== -1) {
                    setActive(matchIndex);
                }

                searchTimeoutRef.current = setTimeout(() => {
                    rl.clearLine(0);
                }, 700);
            }
        });

        useEffect(
            () => () => {
                clearTimeout(searchTimeoutRef.current);
            },
            [],
        );

        const message = theme.style.message(config.message, status);

        let helpTipTop = '';
        let helpTipBottom = '';
        if (
            theme.helpMode === 'always' ||
            (theme.helpMode === 'auto' && firstRender.current)
        ) {
            firstRender.current = false;

            if (items.length > pageSize) {
                helpTipBottom = `\n${theme.style.help(`(${config.instructions?.pager ?? 'Use arrow keys to reveal more choices'})`)}`;
            } else {
                helpTipTop = theme.style.help(
                    `(${config.instructions?.navigation ?? 'Use arrow keys'})`,
                );
            }
        }

        const page = usePagination({
            items,
            active,
            renderItem({ item, isActive, index }) {
                if (Separator.isSeparator(item)) {
                    return ` ${item.separator}`;
                }

                const indexLabel = theme.indexMode === 'number' ? `${index + 1}. ` : '';
                if (item.disabled) {
                    const disabledLabel =
                        typeof item.disabled === 'string' ? item.disabled : '(disabled)';
                    return theme.style.disabled(`${indexLabel}${item.name} ${disabledLabel}`);
                }

                const color = isActive ? theme.style.highlight : (x: string) => x;
                const cursor = isActive ? theme.icon.cursor : ` `;
                return color(`${cursor} ${indexLabel}${item.name}`);
            },
            pageSize,
            loop,
        });

        if (status === 'done') {
            return `${prefix} ${message} ${theme.style.answer(selectedChoice.short)}`;
        }

        const choiceDescription = selectedChoice.description
            ? `\n${theme.style.description(selectedChoice.description)}`
            : ``;

        return `${[prefix, message, helpTipTop].filter(Boolean).join(' ')}\n${page}${helpTipBottom}${choiceDescription}${ansiEscapes.cursorHide}`;
    },
);

export { Separator } from '@inquirer/core';