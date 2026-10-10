import React from 'react';
import fs from 'fs';
import {ConfigProvider} from 'antd';
import {extractStyle} from '@ant-design/static-style-extract';
import postcss from 'postcss';
import {theme, darkTheme} from '../packages/editor/style/theme.ts';

const cssText = extractStyle((node: React.JSX.Element) => (
  <ConfigProvider theme={{...theme, zeroRuntime: false, hashed: false}}>{node}</ConfigProvider>
));

// Include dark component variables for custom views that use Ant Design's CSS classes.
const darkVariables = postcss.parse(
  extractStyle((node: React.JSX.Element) => (
    <ConfigProvider theme={{...darkTheme, zeroRuntime: false, hashed: false}}>{node}</ConfigProvider>
  ))
);
for (const node of [...darkVariables.nodes]) {
  if (node.type !== 'rule' || !node.selector.includes('.css-var-r0-dark')) node.remove();
}

fs.writeFileSync('css/antd.css', cssText + darkVariables.toString());
