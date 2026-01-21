import {PassThrough, Readable} from 'stream';

export function createFallbackReadable(
    primary: Readable,
    fallbackFactory: () => Readable
): Readable {
    const proxy = new PassThrough();
    let hasSwitched = false;

    const switchToFallback = () => {
        if (hasSwitched) return;
        hasSwitched = true;

        // 1. Cleanup the failing primary
        primary.unpipe(proxy);
        primary.destroy();

        // 2. Initialize and pipe the fallback
        const fallback = fallbackFactory();

        // On the fallback, we allow it to end the proxy naturally
        fallback.pipe(proxy);

        fallback.on('error', (err) => {
            proxy.emit('error', err); // If fallback fails too, it's a hard error
        });
    };

    // Pipe primary but prevent it from closing the proxy automatically
    primary.pipe(proxy, { end: false });

    primary.on('error', () => {
        switchToFallback();
    });

    // Handle the "Early End" case (e.g., stream closed before data finished)
    primary.on('end', () => {
        if (!hasSwitched) {
            // If we finished successfully without erroring, close the proxy
            proxy.end();
        }
    });

    return proxy;
}
