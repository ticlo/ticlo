import fs from 'fs';
import path from 'path';

const SKIP_DIRECTORY_NAMES = new Set(['node_modules']);
const fsp = fs.promises;

function getTargetDirectories(): string[] {
  const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
  try {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    const includes: string[] = tsconfig.include ?? [];
    const dirs = new Set<string>();
    for (const include of includes) {
      const normalized = include.replace(/\\/g, '/').replace(/^\.\//, '');
      const segment = normalized.split('/').find(Boolean);
      if (segment && segment !== '**') {
        dirs.add(segment);
      }
    }
    if (dirs.size > 0) {
      return [...dirs];
    }
  } catch (err) {
    console.warn(`Unable to derive targets from tsconfig.json: ${(err as Error).message}`);
  }
  return [];
}

async function removeIfExists(filePath: string) {
  try {
    await fsp.unlink(filePath);
    console.log(`Removed ${path.relative(process.cwd(), filePath)}`);
    return true;
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return false;
    }
    throw err;
  }
}

async function deleteArtifacts(dtsFile: string) {
  const basePath = dtsFile.slice(0, -'.d.ts'.length);
  const candidates = [dtsFile, `${basePath}.js`, `${basePath}.js.map`, `${basePath}.d.ts.map`];

  for (const candidate of new Set(candidates)) {
    await removeIfExists(candidate);
  }
}

async function traverse(dir: string) {
  const entries = await fsp.readdir(dir, {withFileTypes: true});
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      // allow hidden files but still skip directories we explicitly ignore
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORY_NAMES.has(entry.name)) {
        continue;
      }
      await traverse(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
      await deleteArtifacts(fullPath);
    }
  }
}

async function main() {
  const targetDirectories = getTargetDirectories();
  if (targetDirectories.length === 0) {
    console.warn('No target directories derived from tsconfig.json, nothing to clean.');
    return;
  }
  for (const target of targetDirectories) {
    const absolute = path.join(process.cwd(), target);
    if (!fs.existsSync(absolute)) {
      continue;
    }
    await traverse(absolute);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
