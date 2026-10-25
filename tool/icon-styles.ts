import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {globSync} from 'glob';
import {svgBackground} from '../packages/editor/icon/IconDefinition.ts';

const workspaceDir = fileURLToPath(new URL('..', import.meta.url));

export function buildIcons() {
  const files = globSync('icons/*.svg', {cwd: workspaceDir, posix: true}).sort();
  const rules = files.map((file) => {
    const name = path.basename(file, '.svg');
    const svg = fs.readFileSync(path.join(workspaceDir, file), 'utf8');
    return `.tico-svg-${name} { background-image: ${svgBackground(svg)}; }`;
  });
  fs.mkdirSync(path.join(workspaceDir, 'css'), {recursive: true});
  fs.writeFileSync(path.join(workspaceDir, 'css/icons.css'), rules.join('\n') + '\n');
}
