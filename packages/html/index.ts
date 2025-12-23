import {Functions} from '@ticlo/core';
import './functions/QuerySelector.js';
import './functions/CreateStyle.js';

export * from './connect/FrameServerConnection.js';
export {globalStyle} from './style/CssRules.js';

Functions.addCategory({
  id: 'html',
  name: 'html',
  icon: 'fab:html5',
  color: '4af',
});
