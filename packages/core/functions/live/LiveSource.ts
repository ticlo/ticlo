import type {FunctionCommandDesc, PropDesc} from '../../block/Descriptor.ts';
import type {DataMap} from '../../util/DataTypes.ts';

export type LiveEvent =
  | {type: 'snapshot' | 'update' | 'message'; value: unknown; time?: number; cursor?: string; meta?: DataMap}
  | {type: 'remove'; reason: 'deleted' | 'left-result'}
  | {type: 'status'; status: 'connecting' | 'connected' | 'disconnected' | 'closed' | 'error'; message?: string}
  | {type: 'gap'; dropped?: number};

export type LiveObserver = (event: LiveEvent) => void;

export interface LiveSubscription {
  close(): void;
}

export interface LiveSource<Target> {
  subscribe(target: Target, observer: LiveObserver): LiveSubscription;
}

export interface LiveRow {
  id: string;
  label: string;
  branch?: string;
  target?: string;
  preview?: string;
  observedAt?: number;
}

export interface LivePageRequest {
  limit: number;
  cursor?: string;
}

export interface LivePage {
  rows: LiveRow[];
  cursor?: string;
}

export interface LiveCapabilities {
  tree?: boolean;
  search?: {fields: PropDesc[]};
  liveRows?: boolean;
  liveQuery?: boolean;
  capture?: boolean;
  follow?: boolean;
  publish?: FunctionCommandDesc;
}

export interface LiveExplorer {
  describe(): LiveCapabilities;
  listChildren?(parent: string | undefined, page: LivePageRequest): LivePage | Promise<LivePage>;
  search?(query: DataMap, page: LivePageRequest): LivePage | Promise<LivePage>;
  watchRow?(target: string, observer: LiveObserver): LiveSubscription;
  watchQuery?(query: DataMap, limit: number, observer: (event: LiveQueryEvent) => void): LiveSubscription;
  capture?(query: DataMap, observer: LiveObserver, follow: boolean): LiveSubscription;
}

export interface LiveExplorerSource {
  readonly liveExplorer: LiveExplorer;
}

export type LiveQueryEvent = {type: 'results'; rows: LiveRow[]} | Extract<LiveEvent, {type: 'status' | 'gap'}>;

export type LiveWatchOptions =
  | {targets: string[]}
  | {capture: DataMap; follow?: boolean}
  | {query: DataMap; limit: number};

export interface LiveUpdate {
  target?: string;
  event: LiveEvent | LiveQueryEvent;
}

export const MAX_LIVE_TARGETS = 128;
