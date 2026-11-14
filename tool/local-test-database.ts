import {execFile} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {readFile, rename, writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const exec = promisify(execFile);
interface TestDatabase {
  stateFile: URL;
  service: string;
  image: string;
  port: number;
  env: Record<string, string>;
  ready: string[];
}

export async function localDatabaseAddress({stateFile: file, service, image, port, env, ready}: TestDatabase) {
  const stateFile = fileURLToPath(file);
  const name = `ticlo-test-${service}-${createHash('sha256').update(stateFile).digest('hex').slice(0, 16)}`;
  async function findContainer(id?: string): Promise<string> {
    const filters = ['--filter', `name=^${name}$`, '--filter', `label=ticlo.test=${service}`];
    if (id) filters.push('--filter', `id=${id}`);
    const {stdout} = await exec('podman', ['container', 'ls', '--all', '--quiet', '--no-trunc', ...filters]);
    return stdout.trim();
  }

  const recorded = (
    await readFile(stateFile, 'utf8').catch((error) => {
      if (error.code !== 'ENOENT') throw error;
      return '';
    })
  ).trim();
  let container = (/^[a-f0-9]{64}$/.test(recorded) && (await findContainer(recorded))) || (await findContainer());
  if (!container) {
    try {
      const {stdout} = await exec(
        'podman',
        [
          'create',
          '--name',
          name,
          '--label',
          `ticlo.test=${service}`,
          '--publish',
          `127.0.0.1::${port}`,
          ...Object.keys(env).flatMap((key) => ['--env', key]),
          image,
        ],
        {timeout: 90_000, env: {...process.env, ...env}}
      );
      container = stdout.trim();
    } catch (error) {
      // Another test run may have reserved the container name first.
      if (error.code !== 125 || !(container = await findContainer())) throw error;
    }
  }
  if (container !== recorded) {
    const temp = `${stateFile}.${randomUUID()}`;
    await writeFile(temp, `${container}\n`);
    await rename(temp, stateFile);
  }
  await exec('podman', ['start', container]);
  const {stdout: address} = await exec('podman', ['port', container, `${port}/tcp`]);
  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      await exec('podman', ['exec', container, ...ready]);
      return address.trim();
    } catch (error) {
      if ((error.code !== 1 && error.code !== 2) || Date.now() >= deadline) throw error;
      await delay(250);
    }
  }
}
