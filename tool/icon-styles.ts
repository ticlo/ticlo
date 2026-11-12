import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {globSync} from 'glob';
import {svgBackground} from '../packages/editor/icon/IconDefinition.ts';

const workspaceDir = fileURLToPath(new URL('..', import.meta.url));

export function buildIcons() {
  const files = globSync('icons/functions/*.svg', {cwd: workspaceDir, posix: true}).sort();
  const rules = files.map((file) => {
    const name = path.basename(file, '.svg');
    const svg = fs.readFileSync(path.join(workspaceDir, file), 'utf8').replaceAll('currentColor', 'white');
    return `.tico-svg-${name} { background-image: ${svgBackground(svg)}; }`;
  });
  fs.mkdirSync(path.join(workspaceDir, 'css'), {recursive: true});
  fs.writeFileSync(path.join(workspaceDir, 'css/icons.css'), rules.join('\n') + '\n');

  const components = globSync('icons/files/*.svg', {cwd: workspaceDir, posix: true})
    .sort()
    .map((file) => {
      const name = path.basename(file, '.svg');
      const svg = fs
        .readFileSync(path.join(workspaceDir, file), 'utf8')
        .trim()
        .replace('<svg ', '<svg {...props} ')
        .replace(/\s*\/>/g, ' />');
      return `const ${name}Svg = (props: React.SVGProps<SVGSVGElement>) => (
${svg
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}
);

export function ${name}(props: Omit<React.ComponentProps<typeof Icon>, 'component'>) {
  return <Icon {...props} component={${name}Svg} />;
}`;
    });
  const output = `// Generated from icons/files/*.svg by pnpm build-icons. Do not edit.
import React from 'react';
import AntdIcons from '@ant-design/icons';

const Icon = (AntdIcons.default ?? AntdIcons) as typeof AntdIcons.default;

${components.join('\n\n')}
`;
  const target = path.join(workspaceDir, 'packages/editor/icon/FileIcons.tsx');
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) fs.writeFileSync(target, output);
}
