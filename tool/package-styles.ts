import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile} from 'sass';

const workspaceDir = fileURLToPath(new URL('..', import.meta.url));
export const stylePackages = ['editor', 'react', 'designer'];

export function buildPackageCss(name: string, targetDir = path.join(workspaceDir, 'packages', name)) {
  const entry = path.join(workspaceDir, 'packages', name, 'style/index.scss');
  if (!fs.existsSync(entry)) return;
  const {css} = compile(entry, {loadPaths: [path.join(workspaceDir, 'node_modules')]});
  const output = path.join(targetDir, 'style/index.css');
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, css);
}

export function buildCss() {
  for (const name of stylePackages) buildPackageCss(name);
}
