export const window = {
  createStatusBarItem: jest.fn(() => ({
    text: '',
    tooltip: '',
    command: '',
    show: jest.fn(),
    dispose: jest.fn()
  })),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    show: jest.fn(),
    dispose: jest.fn()
  })),
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showOpenDialog: jest.fn(),
  createWebviewPanel: jest.fn(),
  createTreeView: jest.fn(() => ({ dispose: jest.fn() }))
};

export const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn()
};

export const workspace = {
  createFileSystemWatcher: jest.fn(() => ({
    onDidCreate: jest.fn(),
    onDidChange: jest.fn(),
    onDidDelete: jest.fn(),
    dispose: jest.fn()
  })),
  fs: {
    writeFile: jest.fn(),
    readFile: jest.fn()
  }
};

export const Uri = {
  file: jest.fn((path: string) => ({ fsPath: path, scheme: 'file', path })),
  joinPath: jest.fn((...args: unknown[]) => ({ fsPath: (args as string[]).join('/'), scheme: 'file' }))
};

export enum StatusBarAlignment {
  Left = 1,
  Right = 2
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2
}

export class TreeItem {
  label: string;
  collapsibleState: TreeItemCollapsibleState;
  constructor(label: string, collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class EventEmitter {
  event = jest.fn();
  fire = jest.fn();
  dispose = jest.fn();
}

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3
}
