export {useBlockProps} from './hooks/useBlockProps.js';
export {useFilteredBlocks} from './hooks/useFilteredBlocks.js';
export {useWatchBlock} from './hooks/useWatchBlock.js';
export {Values} from './comp/Values.js';
export {registerComponent, findComponent, renderChildren, TicloComp, isContainerFunction} from './comp/Component.js';

import {Functions} from '@ticlo/core';
import './functions/ToComponent.js';
import './functions/RenderDom.js';
import './elements/HtmlAttributes.js';
import './elements/CommonElements.js';
import './elements/ImgElement.js';
import './elements/InputElement.js';

Functions.addCategory({
  id: 'react:',
  name: 'react',
  icon: 'fab:react',
  color: '5ce',
  ns: 'react',
});
