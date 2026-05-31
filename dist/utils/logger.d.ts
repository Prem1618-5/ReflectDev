/** Logger wrapping a VS Code OutputChannel for structured extension logging. */
export declare class Logger {
    private channel;
    constructor(name: string);
    /** Log an informational message. */
    info(message: string): void;
    /** Log a warning message. */
    warn(message: string): void;
    /** Log an error message with optional Error object. */
    error(message: string, err?: Error): void;
    /** Show the output channel in the Output panel. */
    show(): void;
    /** Dispose the output channel. */
    dispose(): void;
    private timestamp;
}
