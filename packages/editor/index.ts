export * from './block/BlockStage';
export * from './property/PropertyList';
export * from './node-tree/NodeTree';
export {cacheCall} from './util/CachedCallback';
export * from './component/ButtonRadioGroup';

import * as ticloI18n from '@ticlo/core/editor';

// register special view

import './block/view/NoteView';
import './block/view/SliderWidget';
import './block/view/NoteWidget';

import {Icons} from '@blueprintjs/icons';

export async function initEditor() {
  Icons.setLoaderOptions({loader: 'all'});
  const lng = window.localStorage.getItem('ticlo-lng');

  await Promise.all([ticloI18n.init(lng), Icons.loadAll()]);
}
