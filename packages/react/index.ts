export {useBlockProps} from './hooks/useBlockProps.js';
export {useChildren} from './hooks/useChildren.js';
export {useFilteredBlocks} from './hooks/useFilteredBlocks.js';
export {useWatchBlock} from './hooks/useWatchBlock.js';
export {Values} from './types/Values.js';
export {
  registerComponent,
  findComponent,
  renderChildren,
  TicloFuncComp,
  isContainerFunction,
} from './types/Component.js';

import {Functions} from '@ticlo/core';
import './functions/ToComponent.js';
import './html-elements/HtmlAttributes.js';
import './html-elements/CommonElements.js';
import './html-elements/ImgElement.js';
import './html-elements/InputElement.js';

Functions.addCategory({
  id: 'react:',
  name: 'react',
  icon: 'fab:react',
  color: '5ce',
  ns: 'react',
});
