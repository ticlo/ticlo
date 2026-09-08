export {useBlockProps} from './hooks/useBlockProps.tsx';
export {useBlockValue} from './hooks/useBlockValue.ts';
export {useFilteredBlocks} from './hooks/useFilteredBlocks.tsx';
export {useWatchBlock} from './hooks/useWatchBlock.tsx';
export {Values} from './comp/Values.ts';
export {metaKey, renderChildren, TicloComp, useComponentUpdate} from './comp/Component.tsx';

import {globalFunctions} from '@ticlo/core';
import './functions/ToComponent.tsx';
import './functions/RenderDom.ts';
import './elements/HtmlAttributes.ts';
import './elements/CommonElements.tsx';
import './elements/ImgElement.tsx';
import './elements/InputElement.tsx';
import './jsx/JsxComponent.tsx';

globalFunctions.addCategory({
  id: 'react:',
  name: 'react',
  icon: 'fab:react',
  color: '5ce',
  ns: 'react',
});
