import {promises as fs} from 'fs';
import path from 'path';
import * as sass from 'sass';
import {fileURLToPath} from 'url';
import {sassNodeModulesLoadPaths, sassSvgInlinerFactory} from '@blueprintjs/node-build-scripts';
import postcss from 'postcss';
import type {Root} from 'postcss';

async function buildBlueprintStyles() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, '..');
  const inputFile = path.join(projectRoot, 'packages/editor/style/blueprint.scss');
  const outputFile = path.join(projectRoot, 'app/css/blueprint.css');
  const iconResourcesDir = path.join(projectRoot, 'icons/blueprintjs');

  const loadPaths = [
    ...sassNodeModulesLoadPaths,
    path.join(projectRoot, 'node_modules/.pnpm/node_modules'),
    path.join(projectRoot, 'packages/editor/node_modules'),
  ];

  const result = await sass.compileAsync(inputFile, {
    loadPaths,
    functions: {
      'svg-icon($path, $selectors: null)': sassSvgInlinerFactory(iconResourcesDir, {
        optimize: true,
        encodingFormat: 'uri',
      }),
    },
  });

  const processedCss = await stripFocusSelectors(result.css);

  await fs.mkdir(path.dirname(outputFile), {recursive: true});
  await fs.writeFile(outputFile, processedCss, 'utf8');
  console.log(`[build-scss] Wrote ${path.relative(projectRoot, outputFile)}`);
}

buildBlueprintStyles().catch((error) => {
  console.error('[build-scss] Failed to build Blueprint SCSS:', error);
  process.exit(1);
});

async function stripFocusSelectors(css: string): Promise<string> {
  const plugin = {
    postcssPlugin: 'strip-focus-selectors',
    Once(root: Root) {
      root.walkRules((rule) => {
        const selectors = rule.selectors;
        if (!selectors || selectors.length === 0) {
          return;
        }

        const filtered = selectors.filter((selector) => {
          const normalized = selector.replace(/\s+/g, ' ').trim();
          if (normalized === ':focus' || normalized === '.bp6-dark :focus') {
            return false;
          }
          return true;
        });

        if (filtered.length === 0) {
          rule.remove();
        } else if (filtered.length !== selectors.length) {
          rule.selectors = filtered;
        }
      });
    },
  };

  const result = await postcss([plugin]).process(css, {from: undefined});
  return result.css;
}

