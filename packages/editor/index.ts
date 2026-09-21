export * from './block/BlockStage.tsx';
export * from './property/PropertyList.tsx';
export * from './component/EditPolicyContext.tsx';
export * from './node-tree/NodeTree.tsx';
export {cacheCall} from './util/CachedCallback.ts';

import * as ticloI18n from '@ticlo/core/editor.ts';

// register special view

import './block/view/NoteView.tsx';
import './block/view/SliderWidget.tsx';
import './block/view/NoteWidget.tsx';

export async function initEditor() {
  const lng = window.localStorage.getItem('ticlo-lng');
  await ticloI18n.init(lng);
}
