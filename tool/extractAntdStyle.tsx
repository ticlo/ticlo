import React from 'react';
import fs from 'fs';
import {ConfigProvider} from 'antd';
import {extractStyle} from '@ant-design/static-style-extract';
import {theme} from '../packages/editor/style/theme';

const cssText = extractStyle((node: JSX.Element) => <ConfigProvider theme={theme}>{node}</ConfigProvider>);

fs.writeFileSync('app/css/antd.css', cssText);
