import fs from 'fs';
import {normalize} from 'path';
import shelljs from 'shelljs';
import * as glob from 'glob';

const dirHistory = new Set<string>();
const temporaryPaths: string[] = [];
const workspaceVersions = new Map<string, string>();

for (const manifestPath of glob.sync('packages/*/package.json', {posix: true})) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  workspaceVersions.set(manifest.name, manifest.version);
}

function resolveWorkspaceDependencies(manifest: any) {
  for (const sectionName of ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies']) {
    const section = manifest[sectionName];
    if (!section) {
      continue;
    }
    for (const [name, specifier] of Object.entries(section)) {
      if (typeof specifier !== 'string' || !specifier.startsWith('workspace:')) {
        continue;
      }
      const version = workspaceVersions.get(name);
      if (!version) {
        throw new Error(`unable to resolve workspace dependency ${name}`);
      }
      const range = specifier.substring('workspace:'.length);
      section[name] = range === '*' ? version : range === '^' || range === '~' ? `${range}${version}` : range;
    }
  }
}

function makeDir(path: string) {
  if (path.lastIndexOf('.') > path.length - 5) {
    // when there is extension, use parent folder
    path = path.substring(0, path.lastIndexOf('/'));
  }
  if (dirHistory.has(path)) {
    return;
  }
  dirHistory.add(path);
  shelljs.mkdir('-p', path);
}

async function buildPackage(name: string) {
  const fromDir = `packages/${name}`;
  console.log(`building ${fromDir}`);
  // Build packages in dependency order so later packages can use earlier output.
  const targetDir = `./build/${name}`;
  console.log(targetDir);
  shelljs.rm('-rf', targetDir);
  makeDir(targetDir);
  // copy tsconfig
  shelljs.cp('./tool/package-tsconfig.json', targetDir);
  shelljs.mv(`${targetDir}/package-tsconfig.json`, `${targetDir}/tsconfig.json`);

  // copy+analyze+convert ts files

  const srcFiles: string[] = glob.sync(`${fromDir}/**/*.{ts,tsx}`, {
    posix: true,
    nodir: true,
    ignore: ['**/node_modules/**'],
  });
  const sourceFiles: string[] = [`${targetDir}/tsconfig.json`]; // files to be deleted after compiling
  for (const tsFile of srcFiles) {
    if (!tsFile.includes('/__spec__/') && !tsFile.includes('/tests/')) {
      const data = fs.readFileSync(tsFile, {encoding: 'utf8'});

      // analyze file, and fix file content
      // TODO, nothing needs to be fixed for now

      // copy file to build
      const newFile = tsFile.replace(fromDir, targetDir);
      sourceFiles.push(newFile);
      makeDir(newFile);
      fs.writeFileSync(newFile, data);
    }
  }

  // update package.json
  const packageJson: any = JSON.parse(fs.readFileSync(`${fromDir}/package.json`, {encoding: 'utf8'}));
  resolveWorkspaceDependencies(packageJson);
  fs.writeFileSync(`${targetDir}/package.json`, JSON.stringify(packageJson, null, 2));

  // pnpm keeps dependencies under each workspace package. Make them available
  // while compiling the copied sources, then remove the temporary link.
  const nodeModulesPath = `${targetDir}/node_modules`;
  shelljs.ln('-s', normalize(`../../${fromDir}/node_modules`), nodeModulesPath);
  temporaryPaths.push(nodeModulesPath);

  // run tsc
  shelljs.pushd('-q', targetDir);
  console.log(`compiling ${targetDir}`);
  const result = shelljs.exec(normalize('../../node_modules/.bin/tsc'));
  shelljs.popd('-q');

  // delete ts files
  shelljs.rm(sourceFiles);
  if (result.code !== 0) {
    throw new Error(`failed to compile ${fromDir}`);
  }
}

async function main() {
  makeDir('build');
  try {
    await buildPackage('core');

    await buildPackage('html');

    // await buildPackage('editor');
    // shelljs.cp('./dist/*.css', './build/editor');
    //
    await buildPackage('react');
    //
    // await buildPackage('node');
    //
    // await buildPackage('express');
  } finally {
    shelljs.rm(temporaryPaths);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
