import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import WebSocket, { WebSocketServer } from 'ws';

import { transaction } from '../db/pool.js';
import { markRoomSaved } from '../repositories/roomRepository.js';
import { loadSnapshot, saveSnapshot } from '../repositories/yjsSnapshotRepository.js';
import { verifyRoomToken } from '../services/authService.js';
import config from '../../config.js';

type SharedMap<T> = { delete: (key: string) => void; values: () => IterableIterator<T> };
type SharedText = { length: number };
type SharedDoc = {
  name: string;
  on: (event: 'update', listener: (update: Uint8Array, origin: unknown) => void) => void;
  getMap: <T>(name: string) => SharedMap<T>;
  transact: (work: () => void) => void;
};
const Y = require('yjs') as {
  encodeStateAsUpdate: (doc: SharedDoc) => Uint8Array;
  encodeStateVector: (doc: SharedDoc) => Uint8Array;
  applyUpdate: (doc: SharedDoc, update: Uint8Array, origin?: unknown) => void;
};
type Persistence = {
  provider: null;
  bindState: (docName: string, doc: SharedDoc) => Promise<void>;
  writeState: (docName: string, doc: SharedDoc) => Promise<void>;
};

const utils = require('y-websocket/bin/utils') as {
  setupWSConnection: (socket: WebSocket, request: IncomingMessage, options: { docName: string }) => void;
  setPersistence: (persistence: Persistence) => void;
  getYDoc: (docName: string, gc?: boolean) => SharedDoc;
  docs: Map<string, SharedDoc>;
};

const bindingPromises = new Map<string, Promise<void>>();
const flushTimers = new Map<string, NodeJS.Timeout>();

async function persistDocument(roomId: string, doc: SharedDoc) {
  const files = doc.getMap<SharedText>('files');
  for (const text of files.values()) {
    if (text.length > config.limits.maxDocumentBytes) {
      throw new Error('单文件内容超过持久化上限');
    }
  }
  const snapshot = Y.encodeStateAsUpdate(doc);
  const stateVector = Y.encodeStateVector(doc);
  return transaction(async (client) => {
    const version = await saveSnapshot(client, roomId, snapshot, stateVector);
    const savedAt = await markRoomSaved(client, roomId);
    return { version, savedAt: savedAt.toISOString() };
  });
}

function scheduleFlush(roomId: string, doc: SharedDoc) {
  const previous = flushTimers.get(roomId);
  if (previous) clearTimeout(previous);
  flushTimers.set(roomId, setTimeout(() => {
    flushTimers.delete(roomId);
    void persistDocument(roomId, doc).catch((error) => {
      console.error(`[Yjs ${roomId}] 快照保存失败：`, error instanceof Error ? error.message : error);
    });
  }, 2_000));
}

utils.setPersistence({
  provider: null,
  bindState: (roomId, doc) => {
    const promise = (async () => {
      const snapshot = await loadSnapshot(roomId);
      if (snapshot) Y.applyUpdate(doc, snapshot, 'database-restore');
      doc.on('update', (_update: Uint8Array, origin: unknown) => {
        if (origin !== 'database-restore') scheduleFlush(roomId, doc);
      });
    })();
    bindingPromises.set(roomId, promise);
    return promise;
  },
  writeState: async (roomId, doc) => {
    const timer = flushTimers.get(roomId);
    if (timer) clearTimeout(timer);
    flushTimers.delete(roomId);
    try {
      await persistDocument(roomId, doc);
    } catch (error) {
      console.error(`[Yjs ${roomId}] 断开时保存失败：`, error instanceof Error ? error.message : error);
    }
  },
});

async function prepareRoomDocument(roomId: string): Promise<SharedDoc> {
  const doc = utils.getYDoc(roomId, false);
  await bindingPromises.get(roomId);
  return doc;
}

export async function flushRoomDocument(roomId: string) {
  const doc = await prepareRoomDocument(roomId);
  const timer = flushTimers.get(roomId);
  if (timer) clearTimeout(timer);
  flushTimers.delete(roomId);
  return persistDocument(roomId, doc);
}

export async function removeRoomDocuments(roomId: string, documentKeys: string[]) {
  const doc = await prepareRoomDocument(roomId);
  const files = doc.getMap<unknown>('files');
  doc.transact(() => {
    for (const key of documentKeys) files.delete(key);
  });
  return flushRoomDocument(roomId);
}

export async function flushAllDocuments(): Promise<void> {
  for (const timer of flushTimers.values()) clearTimeout(timer);
  flushTimers.clear();
  await Promise.all(Array.from(utils.docs, ([roomId, doc]) => persistDocument(roomId, doc)));
}

export default function registerYjsServer(server: HttpServer): void {
  const yjsWss = new WebSocketServer({ noServer: true, maxPayload: config.limits.maxDocumentBytes });
  yjsWss.on('connection', (ws, request) => {
    const docName = request.url?.slice(1).split('?')[0] || 'default-room';
    utils.setupWSConnection(ws, request, { docName });
  });

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url ?? '';
    if (url.startsWith('/socket.io')) return;
    if (!url.startsWith('/yjs/')) {
      socket.destroy();
      return;
    }

    void (async () => {
      try {
        const parsedUrl = new URL(url, `http://${request.headers.host ?? 'localhost'}`);
        const roomFromUrl = decodeURIComponent(parsedUrl.pathname.replace(/^\/yjs\//, ''));
        const token = parsedUrl.searchParams.get('token');
        if (!token) throw new Error('未提供 Token');
        const payload = verifyRoomToken(token);
        if (payload.roomId !== roomFromUrl) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }
        await prepareRoomDocument(roomFromUrl);
        request.url = `/${roomFromUrl}`;
        yjsWss.handleUpgrade(request, socket, head, (ws) => yjsWss.emit('connection', ws, request));
      } catch (error) {
        console.error('[Yjs 鉴权] 连接失败：', error instanceof Error ? error.message : '未知错误');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    })();
  });
}
