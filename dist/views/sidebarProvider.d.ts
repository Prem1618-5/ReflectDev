/**
 * @module sidebarProvider
 * @description Provides a TreeView for the ReflectDev sidebar, showing
 * live scores, last session info, recommendations, and recent sessions.
 * Implements vscode.TreeDataProvider for the reflectdev-sidebar view.
 */
import * as vscode from 'vscode';
import { SessionStore } from '../store/sessionStore';
/**
 * A tree item for the ReflectDev sidebar.
 * Extends vscode.TreeItem with optional children for building the tree hierarchy.
 */
export declare class ReflectDevItem extends vscode.TreeItem {
    /** Child items for tree expansion. */
    children?: ReflectDevItem[];
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, children?: ReflectDevItem[]);
}
/**
 * Provides tree data for the ReflectDev sidebar view.
 * Shows score summary, last session details, recommendations, and recent sessions.
 */
export declare class SidebarProvider implements vscode.TreeDataProvider<ReflectDevItem> {
    private _onDidChangeTreeData;
    /** Event to signal tree data has changed. */
    readonly onDidChangeTreeData: vscode.Event<void>;
    private readonly store;
    /**
     * Creates a new SidebarProvider.
     * @param store - SessionStore to read sessions from.
     */
    constructor(store: SessionStore);
    /**
     * Refreshes the tree view by firing the onDidChangeTreeData event.
     */
    refresh(): void;
    /**
     * Returns the tree item representation for a given element.
     * @param element - The ReflectDevItem to get the tree item for.
     * @returns The tree item.
     */
    getTreeItem(element: ReflectDevItem): vscode.TreeItem;
    /**
     * Returns the children for a given element, or root items if no element provided.
     * @param element - The parent element, or undefined for root items.
     * @returns Array of child ReflectDevItems.
     */
    getChildren(element?: ReflectDevItem): Promise<ReflectDevItem[]>;
    /**
     * Builds the "no sessions" empty state with an import action.
     */
    private buildEmptyState;
    /**
     * Builds the full score tree with all sections.
     * @param sessions - All stored chat sessions (newest first).
     */
    private buildScoreTree;
    /**
     * Creates a leaf item (no children, not expandable).
     * @param label - The display label for the item.
     */
    private createLeafItem;
}
