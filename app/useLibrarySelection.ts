import {useState} from 'react';
import type {ClientConnection} from '@ticlo/core/connect/ClientConnection.ts';
import type {LibrarySelectionOptions} from '@ticlo/editor/library/LibrarySelectDialog.tsx';
import {validateLibrary} from '@ticlo/core/util/LibraryMetadata.ts';
import {replaceUrlQuery} from './url-state.ts';

export async function loadLibrarySelection(
  conn: ClientConnection,
  defaultLibrary: string,
  name: string,
  options: LibrarySelectionOptions
) {
  const alreadyLoaded = (await conn.getLibraryGraph()).roots.includes(name);
  await conn.enableLibrary(name);
  if (options.unloadOthers) {
    const keep = options.setDefault || name === defaultLibrary ? [name] : [defaultLibrary, name];
    try {
      await conn.retainLibraries(keep);
    } catch (error) {
      if (!alreadyLoaded) await conn.unloadLibrary(name);
      throw error;
    }
  }
}

export function useLibrarySelection(conn: ClientConnection, project: string, initialFlow?: string) {
  const [selection, setSelection] = useState({project, initialFlow});
  const setDefaultLibrary = async (name: string) => {
    validateLibrary(name);
    replaceUrlQuery({path: null, flow: null, project: name});
    setSelection({project: name, initialFlow: undefined});
  };
  const selectLibrary = async (name: string, options: LibrarySelectionOptions) => {
    await loadLibrarySelection(conn, selection.project, name, options);
    conn.childrenChangeStream().dispatch({path: ''});
    if (options.setDefault && name !== selection.project) await setDefaultLibrary(name);
    else setSelection((current) => ({...current}));
  };
  const unloadLibrary = async (name: string) => {
    if (name === selection.project) throw new Error('Default library cannot be unloaded');
    await conn.unloadLibrary(name);
    conn.childrenChangeStream().dispatch({path: ''});
    setSelection((current) => ({...current}));
  };
  return {...selection, selectLibrary, unloadLibrary, setDefaultLibrary};
}
