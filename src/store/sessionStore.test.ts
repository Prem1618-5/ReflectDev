import { SessionStore } from './sessionStore';
import { ChatSession } from '../models/session';

const makeSession = (id: string): ChatSession => ({
  id,
  source: 'import',
  startedAt: new Date('2026-05-30T10:00:00Z'),
  messages: [],
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCostUSD: 0,
  status: 'complete',
});

const createMockContext = () => {
  const store: Record<string, unknown> = {};
  return {
    globalState: {
      get: jest.fn(<T>(key: string, defaultValue?: T): T => {
        return (store[key] as T) ?? (defaultValue as T);
      }),
      update: jest.fn(async (key: string, value: unknown): Promise<void> => {
        store[key] = value;
      }),
      keys: jest.fn(() => Object.keys(store)),
      setKeysForSync: jest.fn(),
    },
    subscriptions: [],
    extensionUri: { fsPath: '/test' },
    extensionPath: '/test',
    globalStorageUri: { fsPath: '/test/storage' },
    storagePath: '/test/storage',
    logPath: '/test/log',
    extensionMode: 1,
    extension: { id: 'reflectdev.reflectdev', extensionUri: { fsPath: '/test' }, extensionPath: '/test', isActive: true, packageJSON: {}, exports: undefined, extensionKind: 1, activate: jest.fn() },
    environmentVariableCollection: {},
    secrets: { get: jest.fn(), store: jest.fn(), delete: jest.fn(), onDidChange: jest.fn() },
    storageUri: { fsPath: '/test/storage' },
    workspaceState: { get: jest.fn(), update: jest.fn(), keys: jest.fn(), setKeysForSync: jest.fn() },
    asAbsolutePath: jest.fn((p: string) => `/test/${p}`),
    languageModelAccessInformation: { onDidChange: jest.fn(), canSendRequest: jest.fn() },
  } as unknown as import('vscode').ExtensionContext;
};

describe('SessionStore', () => {
  let store: SessionStore;
  let context: import('vscode').ExtensionContext;

  beforeEach(() => {
    context = createMockContext();
    store = new SessionStore(context);
  });

  it('should add a session and retrieve it', async () => {
    const session = makeSession('session-1');
    await store.addSession(session);
    const sessions = await store.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('session-1');
  });

  it('should skip duplicate sessions', async () => {
    const session = makeSession('session-1');
    await store.addSession(session);
    await store.addSession(session);
    const sessions = await store.getSessions();
    expect(sessions).toHaveLength(1);
  });

  it('should clear all sessions', async () => {
    await store.addSession(makeSession('session-1'));
    await store.addSession(makeSession('session-2'));
    await store.clearAll();
    const sessions = await store.getSessions();
    expect(sessions).toHaveLength(0);
  });

  it('should get a session by id', async () => {
    await store.addSession(makeSession('session-1'));
    const session = await store.getSession('session-1');
    expect(session).toBeDefined();
    expect(session?.id).toBe('session-1');
  });

  it('should return undefined for non-existent session', async () => {
    const session = await store.getSession('non-existent');
    expect(session).toBeUndefined();
  });

  it('should update a session', async () => {
    await store.addSession(makeSession('session-1'));
    await store.updateSession('session-1', { status: 'interrupted' });
    const session = await store.getSession('session-1');
    expect(session?.status).toBe('interrupted');
  });
});
