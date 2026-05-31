import * as vscode from 'vscode';

/** Logger wrapping a VS Code OutputChannel for structured extension logging. */
export class Logger {
  private channel: vscode.OutputChannel;

  constructor(name: string) {
    this.channel = vscode.window.createOutputChannel(name);
  }

  /** Log an informational message. */
  info(message: string): void {
    this.channel.appendLine(`[INFO  ${this.timestamp()}] ${message}`);
  }

  /** Log a warning message. */
  warn(message: string): void {
    this.channel.appendLine(`[WARN  ${this.timestamp()}] ${message}`);
  }

  /** Log an error message with optional Error object. */
  error(message: string, err?: Error): void {
    this.channel.appendLine(`[ERROR ${this.timestamp()}] ${message}`);
    if (err) {
      this.channel.appendLine(`  ${err.message}`);
      if (err.stack) {
        this.channel.appendLine(`  ${err.stack}`);
      }
    }
  }

  /** Show the output channel in the Output panel. */
  show(): void {
    this.channel.show(true);
  }

  /** Dispose the output channel. */
  dispose(): void {
    this.channel.dispose();
  }

  private timestamp(): string {
    return new Date().toISOString().slice(11, 23);
  }
}
