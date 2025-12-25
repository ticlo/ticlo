import React from 'react';
import fs from 'fs';
import {ConfigProvider} from 'antd';
import {extractStyle} from '@ant-design/static-style-extract';
import {theme} from '../packages/editor/style/theme.js';

const cssText = extractStyle((node: JSX.Element) => (
  <ConfigProvider theme={{...theme, zeroRuntime: false}}>{node}</ConfigProvider>
));

const cssTextProd = cssText.replaceAll(/:where\(\.css-dev-only-do-not-override-[a-zA-Z0-9-]*\)/g, '');

fs.writeFileSync('css/antd.css', cssTextProd);
