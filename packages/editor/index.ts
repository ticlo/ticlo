export * from './block/BlockStage.js';
export * from './property/PropertyList.js';
export * from './node-tree/NodeTree.js';
export {cacheCall} from './util/CachedCallback.js';

import * as ticloI18n from '@ticlo/core/editor.js';

// register special view

import './block/view/NoteView.js';
import './block/view/SliderWidget.js';
import './block/view/NoteWidget.js';

export async function initEditor() {
  const lng = window.localStorage.getItem('ticlo-lng');
  await ticloI18n.init(lng);
}
