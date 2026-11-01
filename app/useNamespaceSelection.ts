import {useState} from 'react';
import type {Root} from '@ticlo/core';
import type {ClientConnection} from '@ticlo/core/connect/ClientConnection.ts';
import type {NamespaceSelectionOptions} from '@ticlo/editor/namespace/NamespaceSelectDialog.tsx';
import {replaceUrlQuery} from './url-state.ts';

export async function loadNamespaceSelection(
  root: Root,
  defaultNamespace: string,
  name: string,
  options: NamespaceSelectionOptions
) {
  const alreadyLoaded = root.getNamespaceGraph().roots.includes(name);
  await root.enableNamespace(name);
  if (options.unloadOthers) {
    const keep = options.setDefault || name === defaultNamespace ? [name] : [defaultNamespace, name];
    try {
      await root.retainNamespaces(keep);
    } catch (error) {
      if (!alreadyLoaded) await root.unloadNamespace(name);
      throw error;
    }
  }
}

export function useNamespaceSelection(root: Root, conn: ClientConnection, project: string, initialFlow?: string) {
  const [selection, setSelection] = useState({project, initialFlow});
  const setDefaultNamespace = async (name: string) => {
    if (!root.getNamespaceGraph().roots.includes(name)) throw new Error(`Namespace is not manually loaded: ${name}`);
    replaceUrlQuery({path: null, flow: null, project: name});
    setSelection({project: name, initialFlow: undefined});
  };
  const selectNamespace = async (name: string, options: NamespaceSelectionOptions) => {
    await loadNamespaceSelection(root, selection.project, name, options);
    conn.childrenChangeStream().dispatch({path: ''});
    if (options.setDefault && name !== selection.project) await setDefaultNamespace(name);
    else setSelection((current) => ({...current}));
  };
  const unloadNamespace = async (name: string) => {
    if (name === selection.project) throw new Error('Default namespace cannot be unloaded');
    await root.unloadNamespace(name);
    conn.childrenChangeStream().dispatch({path: ''});
    setSelection((current) => ({...current}));
  };
  return {...selection, selectNamespace, unloadNamespace, setDefaultNamespace};
}
