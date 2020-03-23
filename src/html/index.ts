import {Functions} from '../../src/core';

export * from './connect/FrameServerConnection';

Functions.addCategory({
  id: 'html',
  name: 'html',
  icon: 'fab:html5',
  color: '4af',
});

import './functions/QuerySelector';
import './functions/CreateStyle';
