import { isPromise } from "node:util/types";

const shutdownFns: ShutdownFn[] = [];
type ShutdownFn = () => Promise<unknown> | unknown;

export function setupShutdownHook(fn: ShutdownFn) {
    shutdownFns.push(fn);
}

export async function shutdown() {
    let fn: ShutdownFn | undefined;

    const fns = [...shutdownFns].reverse();

    while ((fn = shutdownFns.shift())) {
        try {
            const res = fn();
            if (res && isPromise(res)) await res;
        } catch (error) {
            console.error("Error while shutting down", error);
        }
    }

    setTimeout(() => {
        console.error("Did not perform a clean shutdown");
        process.exit(1);
    }, 3000).unref();
}
