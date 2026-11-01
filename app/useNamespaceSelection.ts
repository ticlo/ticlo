import {useState} from 'react';
import type {Root} from '@ticlo/core';

export function useNamespaceSelection(root: Root, project: string, initialFlow?: string) {
  const [selection, setSelection] = useState({project, initialFlow});
  const switchNamespace = async (name: string) => {
    if (name === selection.project) return;
    await root.switchNamespace(name);
    const params = new URLSearchParams(location.hash.slice(1));
    params.delete('path');
    params.delete('flow');
    params.set('project', name);
    history.replaceState(history.state, '', `${location.pathname}${location.search}#${params}`);
    setSelection({project: name, initialFlow: undefined});
  };
  return {...selection, switchNamespace};
}
