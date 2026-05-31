/**
 * @module extension
 * @description Entry point for the ReflectDev VS Code extension.
 * Registers commands, creates the sidebar TreeView, initializes the session store,
 * and optionally starts the CLI extractor. Status bar shows immediately for fast
 * activation; all heavy work is deferred via setImmediate.
 */
import * as vscode from 'vscode';
/**
 * Activates the ReflectDev extension.
 * Shows status bar immediately, then defers heavy initialization.
 * @param context - The VS Code extension context.
 */
export declare function activate(context: vscode.ExtensionContext): void;
/**
 * Deactivates the ReflectDev extension.
 * Cleanup is handled automatically by context.subscriptions.
 */
export declare function deactivate(): void;
