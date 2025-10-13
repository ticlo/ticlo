export * from './block/BlockStage';
export * from './property/PropertyList';
export * from './node-tree/NodeTree';
export {cacheCall} from './util/CachedCallback';

import * as ticloI18n from '@ticlo/core/editor';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/select/lib/css/blueprint-select.css';
import '@blueprintjs/datetime/lib/css/blueprint-datetime.css';

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
