import {Functions} from '../../src/core';
import {setDefaultStorageFunctionProvider} from '../core/functions/data/Storage';
import {FUNCTION_STORE_NAME, IndexDbStorage} from './storage/IndexDbStorage';
import './functions/QuerySelector';
import './functions/CreateStyle';

export * from './connect/FrameServerConnection';

Functions.addCategory({
  id: 'html',
  name: 'html',
  icon: 'fab:html5',
  color: '4af',
});

setDefaultStorageFunctionProvider(() => new IndexDbStorage(FUNCTION_STORE_NAME));
