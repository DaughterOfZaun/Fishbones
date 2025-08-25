import { launchTerminal } from "./utils/data-terminal";
if(await launchTerminal() === false) try {
    await import('./index.ts')
} catch(e) {
    console.error('Main module import failed', e)
}
