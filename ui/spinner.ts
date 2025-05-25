import {
    createPrompt,
    makeTheme,
    usePrefix,
    type Theme,
} from '@inquirer/core';
import type { PartialDeep } from '@inquirer/type';

export type SpinnerTheme = object /*{}*/
const spinnerTheme: SpinnerTheme = {}
export type SpinnerConfig = {
    message: string
    theme?: PartialDeep<Theme<SpinnerTheme>>
}

export default createPrompt(
    (config: SpinnerConfig, /*done: (value: undefined) => void*/): string => {
        const status = 'loading'
        const theme = makeTheme<SpinnerTheme>(spinnerTheme, config.theme);
        const prefix = usePrefix({ status, theme });
        const message = theme.style.message(config.message, status);
        return `${prefix} ${message}`
    }
)