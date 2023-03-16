export * from './block/BlockStage';
export * from './property/PropertyList';
export * from './node-tree/NodeTree';

import * as ticloI18n from '../../src/core/editor';

// register special view

import './block/view/Note';
import './block/view/Slider';
import './block/view/Comment';

export async function initEditor() {
  let lng = window.localStorage.getItem('ticlo-lng');
  await ticloI18n.init(lng);
}
