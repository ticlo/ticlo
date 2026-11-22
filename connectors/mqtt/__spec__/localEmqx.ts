import {execFile} from 'node:child_process';
import {createSign, generateKeyPairSync} from 'node:crypto';
import {chmod, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {createConnection} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {promisify} from 'node:util';

const exec = promisify(execFile);
const image = 'docker.io/emqx/emqx:5.8';

function checkTcp(host: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = createConnection({host, port});
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export async function startEmqx() {
  const engine = process.env.TICLO_TEST_MQTT_CONTAINER_ENGINE ?? 'podman';
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-emqx-'));
  const confPath = join(dir, 'emqx.conf');
  let container: string | undefined;

  const {publicKey, privateKey} = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {type: 'spki', format: 'pem'},
    privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
  });

  const signJwt = ({user, scope, expiresIn}: {user: string; scope: string; expiresIn: number}) => {
    const now = Math.ceil(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({alg: 'RS256', typ: 'JWT'})).toString('base64url');
    const payload = Buffer.from(JSON.stringify({sub: user, scope, iat: now, exp: now + expiresIn})).toString(
      'base64url'
    );
    const input = `${header}.${payload}`;
    const signature = createSign('RSA-SHA256').update(input).sign(privateKey, 'base64url');
    return `${input}.${signature}`;
  };

  const close = async () => {
    try {
      if (container) await exec(engine, ['rm', '-f', container]);
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  };

  try {
    const config = `node {
  name = "emqx@127.0.0.1"
  cookie = "emqxsecretcookie"
  data_dir = "data"
}

cluster {
  name = emqxcl
  discovery_strategy = manual
}

listeners.tcp.default {
  bind = "0.0.0.0:1883"
}

authentication = [
  {
    mechanism = jwt
    enable = true
    from = password
    algorithm = "public-key"
    use_jwks = false
    disconnect_after_expire = true
    public_key = """
${publicKey.trim()}
"""
  }
]
`;
    await writeFile(confPath, config, {mode: 0o644});
    await chmod(confPath, 0o644);
    const start = await exec(
      engine,
      [
        'run',
        '--detach',
        '--publish',
        '127.0.0.1::1883',
        '--volume',
        `${confPath}:/opt/emqx/etc/emqx.conf:ro,Z`,
        image,
      ],
      {timeout: 120_000}
    );
    container = start.stdout.trim();
    const mapped = (await exec(engine, ['port', container, '1883/tcp'])).stdout.trim().split('\n')[0].trim();
    const port = Number(mapped.split(':').pop());
    const host = mapped.slice(0, mapped.lastIndexOf(':'));

    const deadline = Date.now() + 60_000;
    for (;;) {
      try {
        await exec(engine, ['exec', container, 'emqx', 'ctl', 'status']);
        if (await checkTcp(host, port)) break;
      } catch (error) {
        const {stdout: running} = await exec(engine, ['inspect', '--format', '{{.State.Running}}', container]);
        if (running.trim() !== 'true' || Date.now() >= deadline) {
          const {stdout, stderr} = await exec(engine, ['logs', container]);
          throw new Error(`EMQX did not start: ${(stderr || stdout).trim()}`, {cause: error});
        }
      }
      if (Date.now() >= deadline) {
        const {stdout, stderr} = await exec(engine, ['logs', container]);
        throw new Error(`EMQX timed out: ${(stderr || stdout).trim()}`);
      }
      await delay(250);
    }

    return {
      mqtt: `mqtt://${mapped}`,
      signJwt,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
