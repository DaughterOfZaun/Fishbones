import { useEffect, useRef } from '@inquirer/core';
import { withUpdates } from '../node_modules/@inquirer/core/dist/esm/lib/hook-engine.js';

export function useCallback<T>(
    callback: (handler: (event: T) => unknown) => () => void,
    userHandler: (event: T) => void | Promise<void>,
): void {
    const signal = useRef(userHandler);
    signal.current = userHandler;

    useEffect(() => {
        let ignore = false;
        const handler = withUpdates((event: T) => {
            if (!ignore) void signal.current(event);
        });
        const cleanup = callback(handler)
        return () => {
            ignore = true;
            cleanup();
        };
    }, []);
}