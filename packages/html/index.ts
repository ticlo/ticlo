import {globalFunctions} from '@ticlo/core';
import './functions/QuerySelector.ts';
import './functions/CreateStyle.ts';
import './functions/CssClass.ts';
import './functions/CssSheet.ts';

export * from './connect/FrameServerConnection.ts';
export {globalStyle} from './style/CssSheet.ts';

globalFunctions.addCategory({
  id: 'html',
  name: 'html',
  icon: 'fab:html5',
  color: '4af',
});
