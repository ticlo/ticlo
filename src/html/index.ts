import {Functions} from '@ticlo/core';
import './functions/QuerySelector';
import './functions/CreateStyle';

export * from './connect/FrameServerConnection';

Functions.addCategory({
  id: 'html',
  name: 'html',
  icon: 'fab:html5',
  color: '4af',
});
