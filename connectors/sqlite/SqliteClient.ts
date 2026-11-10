import {Worker} from 'node:worker_threads';
import type {SqlClient, SqlParams, SqlResult, SqlEntity, SqlEntityRef, SqlEntityColumn} from '@ticlo/core';

export interface SqliteOptions {
  filePath: string;
  readOnly?: boolean;
  busyTimeout?: number;
  foreignKeys?: boolean;
}

export type SqliteRequest =
  | {type: 'open'; options: SqliteOptions}
  | {type: 'query'; sql: string; params?: SqlParams}
  | {type: 'listEntities'}
  | {type: 'getColumns'; entity: SqlEntityRef}
  | {type: 'close'};

export interface SqliteResponse {
  id: number;
  result?: SqlResult | SqlEntity[] | SqlEntityColumn[];
  error?: {message: string; code?: string};
}

/** One worker owns one connection, serializing requests without blocking the host. */
export class SqliteClient implements SqlClient {
  private worker: Worker;
  private nextId = 0;
  private pending = new Map<number, {resolve: (result: any) => void; reject: (error: Error) => void}>();
  private failure?: Error;
  private closing?: Promise<void>;

  private constructor() {
    const workerPath = import.meta.url.endsWith('.ts') ? './SqliteWorker.ts' : './SqliteWorker.js';
    this.worker = new Worker(new URL(workerPath, import.meta.url));
    this.worker.on('message', (message: SqliteResponse) => {
      const task = this.pending.get(message.id);
      if (!task) return;
      this.pending.delete(message.id);
      if (message.error) {
        task.reject(Object.assign(new Error(message.error.message), {code: message.error.code}));
      } else {
        task.resolve(message.result);
      }
    });
    this.worker.on('error', (error) => this.fail(error instanceof Error ? error : new Error(String(error))));
    this.worker.on('exit', (code) => this.fail(new Error(`SQLite worker exited (${code})`)));
  }

  static async open(options: SqliteOptions): Promise<SqliteClient> {
    const client = new SqliteClient();
    try {
      await client.request({type: 'open', options});
      return client;
    } catch (error) {
      await client.worker.terminate();
      throw error;
    }
  }

  query(sql: string, params?: SqlParams): Promise<SqlResult> {
    return this.request({type: 'query', sql, params});
  }

  listEntities(): Promise<SqlEntity[]> {
    return this.request({type: 'listEntities'});
  }

  getColumns(entity: SqlEntityRef): Promise<SqlEntityColumn[]> {
    return this.request({type: 'getColumns', entity});
  }

  close(): Promise<void> {
    if (!this.closing) {
      // Already submitted queries finish before close; new queries are rejected.
      this.closing = this.request({type: 'close'})
        .then(() => {})
        .finally(async () => {
          await this.worker.terminate();
        });
    }
    return this.closing;
  }

  private request<T = SqlResult>(request: SqliteRequest): Promise<T> {
    if (this.closing) return Promise.reject(new Error('SQLite client is closed'));
    if (this.failure) return Promise.reject(this.failure);
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
      try {
        this.worker.postMessage({...request, id});
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  private fail(error: Error) {
    this.failure = error;
    for (const task of this.pending.values()) task.reject(error);
    this.pending.clear();
  }
}
