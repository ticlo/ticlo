import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';

const prettierPattern = /^(packages|tool|app)\/.*\.(ts|tsx|less)$/;
const prettierScript = 'node_modules/prettier/bin/prettier.cjs';

function run(command, args) {
  const result = spawnSync(command, args, {stdio: 'inherit'});
  if (result.error) {
    console.error(`Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const diff = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {encoding: 'utf8'});
if (diff.status !== 0) {
  process.stderr.write(diff.stderr || 'failed to list staged files\n');
  process.exit(diff.status ?? 1);
}

const files = diff.stdout
  .split('\n')
  .map((file) => file.trim())
  .filter((file) => prettierPattern.test(file));

if (files.length === 0) {
  console.log('No staged prettier files changed.');
  process.exit(0);
}

if (!existsSync(prettierScript)) {
  console.error(`Prettier was not found at ${prettierScript}. Run pnpm install first.`);
  process.exit(1);
}

run(process.execPath, [prettierScript, '--write', ...files]);
run('git', ['add', '--', ...files]);
