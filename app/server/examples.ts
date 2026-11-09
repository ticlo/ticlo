import {access, mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

/** Seed editable examples without replacing files from an earlier run. */
export async function initExamples(serverDirectory: string) {
  const project = join(serverDirectory, 'examples');
  if (await mkdir(project, {recursive: true})) {
    await writeFile(join(project, '.proj'), JSON.stringify({id: 'examples', name: 'Examples'}), {flag: 'wx'});
  }

  const path = join(project, 'large-table.ticlo');
  try {
    await access(path);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const rows = Array.from({length: 100_000}, (_, index) => ({
    id: index + 1,
    name: `Row ${index + 1}`,
    category: 'ABCD'[index % 4],
    amount: ((index * 37) % 100_000) / 100,
    enabled: index % 3 !== 0,
  }));
  Object.assign(rows[0], {firstRow: 'First row'});
  Object.assign(rows.at(-1), {lastRow: 'Last row'});
  const flow = {
    '#is': '',
    'table': {
      '#is': 'create-object',
      '#custom': [{name: 'rows', type: 'table', pinned: true}],
      'rows': rows,
      '@b-xyw': [80, 80, 300],
      '@b-p': ['rows'],
    },
  };
  try {
    await writeFile(path, JSON.stringify(flow), {flag: 'wx'});
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
}
