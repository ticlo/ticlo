import {globalFunctions} from '@ticlo/core';
import './functions/QuerySelector.js';
import './functions/CreateStyle.js';
import './functions/CssClass.js';
import './functions/CssSheet.js';

export * from './connect/FrameServerConnection.js';
export {globalStyle} from './style/CssSheet.js';

globalFunctions.addCategory({
  id: 'html',
  name: 'html',
  icon: 'fab:html5',
  color: '4af',
});
