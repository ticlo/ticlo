import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile} from 'sass';

const workspaceDir = fileURLToPath(new URL('..', import.meta.url));
export const stylePackages = ['editor', 'react', 'designer', 'chart'];

export function buildPackageCss(packageDir: string, targetDir = path.join(workspaceDir, packageDir)) {
  const entry = path.join(workspaceDir, packageDir, 'style/index.scss');
  if (!fs.existsSync(entry)) return;
  const {css} = compile(entry, {loadPaths: [path.join(workspaceDir, 'node_modules')]});
  const output = path.join(targetDir, 'style/index.css');
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, css);
  const fontsDir = path.join(path.dirname(entry), 'fonts');
  const targetFontsDir = path.join(targetDir, 'style/fonts');
  if (fs.existsSync(fontsDir) && path.resolve(fontsDir) !== path.resolve(targetFontsDir)) {
    fs.cpSync(fontsDir, targetFontsDir, {recursive: true});
  }
}

export function buildCss() {
  for (const name of stylePackages) buildPackageCss(`packages/${name}`);
  const connectorsDir = path.join(workspaceDir, 'connectors');
  if (fs.existsSync(connectorsDir)) {
    for (const name of fs.readdirSync(connectorsDir)) buildPackageCss(`connectors/${name}`);
  }
}
