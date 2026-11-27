import {useEffect, useMemo, useState} from 'react';
import {classifyFilePath, type Block, type FlowStorage} from '@ticlo/core';
import {Library} from '@ticlo/core/block/Library.ts';

interface PendingState {
  promise: Promise<string | undefined>;
  resolved?: string;
}

/** Resolve a file-path property synchronously when possible, or await async storage resolution (e.g. BrowserLocal). */
export function useResolvedFilePath(block: Block, path?: string): string | undefined {
  const flow = block?._flow;
  const library = flow?._library;
  const storage: FlowStorage | undefined = flow ? Library.rootOf(flow)._storage : undefined;

  const immediate = useMemo(() => {
    if (!path) return {sync: true as const, value: undefined};
    if (!storage?.resolveFilePath) {
      const kind = classifyFilePath(path);
      return {
        sync: true as const,
        value: kind === 'project' || kind === 'relative' || kind === 'frontend' ? undefined : path,
      };
    }
    const result = storage.resolveFilePath(path, library);
    if (result instanceof Promise) {
      return {sync: false as const, promise: result};
    }
    return {sync: true as const, value: result};
  }, [storage, library, path]);

  const [asyncState, setAsyncState] = useState<PendingState>();

  useEffect(() => {
    if (immediate.sync) return;
    let active = true;
    const {promise} = immediate;
    void promise.then(
      (resolved) => {
        if (active) {
          setAsyncState({promise, resolved});
        }
      },
      () => {
        if (active) {
          setAsyncState({promise, resolved: undefined});
        }
      }
    );
    return () => {
      active = false;
    };
  }, [immediate]);

  if (immediate.sync) return immediate.value;
  return asyncState?.promise === immediate.promise ? asyncState.resolved : undefined;
}
