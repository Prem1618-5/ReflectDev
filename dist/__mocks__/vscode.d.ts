export declare const window: {
    createStatusBarItem: jest.Mock<{
        text: string;
        tooltip: string;
        command: string;
        show: jest.Mock<any, any, any>;
        dispose: jest.Mock<any, any, any>;
    }, [], any>;
    createOutputChannel: jest.Mock<{
        appendLine: jest.Mock<any, any, any>;
        show: jest.Mock<any, any, any>;
        dispose: jest.Mock<any, any, any>;
    }, [], any>;
    showInformationMessage: jest.Mock<any, any, any>;
    showWarningMessage: jest.Mock<any, any, any>;
    showErrorMessage: jest.Mock<any, any, any>;
    showOpenDialog: jest.Mock<any, any, any>;
    createWebviewPanel: jest.Mock<any, any, any>;
    createTreeView: jest.Mock<{
        dispose: jest.Mock<any, any, any>;
    }, [], any>;
};
export declare const commands: {
    registerCommand: jest.Mock<any, any, any>;
    executeCommand: jest.Mock<any, any, any>;
};
export declare const workspace: {
    createFileSystemWatcher: jest.Mock<{
        onDidCreate: jest.Mock<any, any, any>;
        onDidChange: jest.Mock<any, any, any>;
        onDidDelete: jest.Mock<any, any, any>;
        dispose: jest.Mock<any, any, any>;
    }, [], any>;
    fs: {
        writeFile: jest.Mock<any, any, any>;
        readFile: jest.Mock<any, any, any>;
    };
};
export declare const Uri: {
    file: jest.Mock<{
        fsPath: string;
        scheme: string;
        path: string;
    }, [path: string], any>;
    joinPath: jest.Mock<{
        fsPath: string;
        scheme: string;
    }, unknown[], any>;
};
export declare enum StatusBarAlignment {
    Left = 1,
    Right = 2
}
export declare enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2
}
export declare class TreeItem {
    label: string;
    collapsibleState: TreeItemCollapsibleState;
    constructor(label: string, collapsibleState?: TreeItemCollapsibleState);
}
export declare class EventEmitter {
    event: jest.Mock<any, any, any>;
    fire: jest.Mock<any, any, any>;
    dispose: jest.Mock<any, any, any>;
}
export declare enum ViewColumn {
    One = 1,
    Two = 2,
    Three = 3
}
