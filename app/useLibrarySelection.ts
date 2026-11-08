import {useState} from 'react';
import type {Root} from '@ticlo/core';
import type {ClientConnection} from '@ticlo/core/connect/ClientConnection.ts';
import type {LibrarySelectionOptions} from '@ticlo/editor/library/LibrarySelectDialog.tsx';
import {replaceUrlQuery} from './url-state.ts';

export async function loadLibrarySelection(
  root: Root,
  defaultLibrary: string,
  name: string,
  options: LibrarySelectionOptions
) {
  const alreadyLoaded = root.getLibraryGraph().roots.includes(name);
  await root.enableLibrary(name);
  if (options.unloadOthers) {
    const keep = options.setDefault || name === defaultLibrary ? [name] : [defaultLibrary, name];
    try {
      await root.retainLibraries(keep);
    } catch (error) {
      if (!alreadyLoaded) await root.unloadLibrary(name);
      throw error;
    }
  }
}

export function useLibrarySelection(root: Root, conn: ClientConnection, project: string, initialFlow?: string) {
  const [selection, setSelection] = useState({project, initialFlow});
  const setDefaultLibrary = async (name: string) => {
    if (!root.getLibraryGraph().roots.includes(name)) throw new Error(`Library is not manually loaded: ${name}`);
    replaceUrlQuery({path: null, flow: null, project: name});
    setSelection({project: name, initialFlow: undefined});
  };
  const selectLibrary = async (name: string, options: LibrarySelectionOptions) => {
    await loadLibrarySelection(root, selection.project, name, options);
    conn.childrenChangeStream().dispatch({path: ''});
    if (options.setDefault && name !== selection.project) await setDefaultLibrary(name);
    else setSelection((current) => ({...current}));
  };
  const unloadLibrary = async (name: string) => {
    if (name === selection.project) throw new Error('Default library cannot be unloaded');
    await root.unloadLibrary(name);
    conn.childrenChangeStream().dispatch({path: ''});
    setSelection((current) => ({...current}));
  };
  return {...selection, selectLibrary, unloadLibrary, setDefaultLibrary};
}
