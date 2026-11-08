import path from 'node:path';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {StorageError} from './types.ts';
import {GitError} from '@ticlo/node-git/GitError.ts';

interface StorageLogger {
  error(error: unknown): void;
}

class HonoReply {
  private readonly headers = new Headers();
  private statusCode = 200;
  private response?: Response;

  code(statusCode: number): this {
    this.statusCode = statusCode;
    return this;
  }

  status(statusCode: number): this {
    return this.code(statusCode);
  }

  header(name: string, value: number | string): this {
    this.headers.set(name, String(value));
    return this;
  }

  type(contentType: string): this {
    return this.header('Content-Type', contentType);
  }

  sent(): boolean {
    return Boolean(this.response);
  }

  send(payload?: unknown): Response {
    if (payload instanceof Response) {
      this.response = payload;
      return payload;
    }

    let body: BodyInit | null;
    if (payload === undefined || payload === null) {
      body = null;
    } else if (typeof payload === 'string') {
      body = payload;
    } else if (Buffer.isBuffer(payload)) {
      body = payload as unknown as BodyInit;
    } else if (payload instanceof ArrayBuffer) {
      body = payload;
    } else if (ArrayBuffer.isView(payload)) {
      body = payload as unknown as BodyInit;
    } else if (payload instanceof Blob || payload instanceof FormData || payload instanceof URLSearchParams) {
      body = payload;
    } else if (payload instanceof ReadableStream) {
      body = payload;
    } else if (payload instanceof Readable) {
      body = Readable.toWeb(payload) as unknown as BodyInit;
    } else {
      body = JSON.stringify(payload);
      if (!this.headers.has('Content-Type')) {
        this.headers.set('Content-Type', 'application/json; charset=utf-8');
      }
    }

    this.response = new Response(body, {
      status: this.statusCode,
      headers: this.headers,
    });
    return this.response;
  }

  toResponse(): Response {
    return this.response ?? this.send();
  }
}

function toPosix(parts: string[]): string {
  return parts.filter(Boolean).join('/');
}

function normalizeInput(rawPath?: string): string {
  if (!rawPath) {
    throw new StorageError('Path is required', 400);
  }
  const trimmed = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const normalized = path.posix.normalize(trimmed);
  if (!normalized || normalized === '.') {
    throw new StorageError('Path is required', 400);
  }
  if (normalized.includes('..')) {
    throw new StorageError('Path cannot contain parent segments', 400);
  }
  return normalized;
}

function buildEtag(content: Uint8Array): string {
  return `"${createHash('sha256').update(content).digest('hex')}"`;
}

// Serialize mutations, including directory moves/deletions, for one storage root.
const mutations = new Map<string, Promise<unknown>>();
async function withStorageLock<T>(root: string, operation: () => Promise<T>): Promise<T> {
  const previous = mutations.get(root) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(operation);
  mutations.set(root, pending);
  try {
    return await pending;
  } finally {
    if (mutations.get(root) === pending) mutations.delete(root);
  }
}

async function handleErrors<T>(reply: HonoReply, executor: () => Promise<T>, logger: StorageLogger): Promise<void> {
  try {
    const payload = await executor();
    if (reply.sent()) {
      return;
    }
    if (payload === undefined) {
      reply.code(204).send();
    } else {
      reply.send(payload);
    }
  } catch (error) {
    if (error instanceof StorageError || error instanceof GitError) {
      reply.code(error.statusCode).send({message: error.message});
      return;
    }
    logger.error(error);
    reply.code(500).send({message: 'Internal Server Error'});
  }
}

export {HonoReply, buildEtag, handleErrors, normalizeInput, toPosix, withStorageLock};
export type {StorageLogger};
