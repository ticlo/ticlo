import {execFile} from 'node:child_process';
import {chmod, copyFile, mkdtemp, mkdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createTlsClientIdentity} from '@ticlo/core';

const exec = promisify(execFile);
const fixtureConfig = fileURLToPath(new URL('./mosquitto.conf', import.meta.url));
const image = 'docker.io/library/eclipse-mosquitto:2.0';
export const mosquittoPassword = 'ticlo_test';

export async function startMosquitto() {
  const engine = process.env.TICLO_TEST_MQTT_CONTAINER_ENGINE ?? 'podman';
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-mqtt-'));
  const fixture = join(dir, 'broker');
  let container: string | undefined;

  const close = async () => {
    try {
      if (container) await exec(engine, ['rm', '-f', container]);
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  };
  try {
    await mkdir(fixture, {mode: 0o755});
    await copyFile(fixtureConfig, join(fixture, 'mosquitto.conf'));
    const openssl = (...args: string[]) => exec('openssl', args, {cwd: dir});
    await openssl(
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-noenc',
      '-days',
      '1',
      '-subj',
      '/CN=Ticlo test CA',
      '-keyout',
      'ca.key',
      '-out',
      'broker/ca.crt'
    );
    for (const [name, subject, usage] of [
      ['broker/server', '/CN=127.0.0.1', 'serverAuth'],
      ['client', '/CN=ticlo', 'clientAuth'],
    ]) {
      const extensions = ['-addext', `extendedKeyUsage=${usage}`];
      if (usage === 'serverAuth') extensions.push('-addext', 'subjectAltName=IP:127.0.0.1');
      await openssl(
        'req',
        '-new',
        '-newkey',
        'rsa:2048',
        '-noenc',
        '-subj',
        subject,
        '-keyout',
        `${name}.key`,
        '-out',
        `${name}.csr`,
        ...extensions
      );
      await openssl(
        'x509',
        '-req',
        '-in',
        `${name}.csr`,
        '-CA',
        'broker/ca.crt',
        '-CAkey',
        'ca.key',
        '-CAserial',
        'ca.srl',
        '-CAcreateserial',
        '-days',
        '1',
        '-copy_extensions',
        'copy',
        '-out',
        `${name}.crt`
      );
    }
    // The container exposes only the disposable test broker certificate and key.
    await chmod(join(fixture, 'server.key'), 0o644);
    const start = await exec(
      engine,
      [
        'run',
        '--detach',
        '--publish',
        '127.0.0.1::1883',
        '--publish',
        '127.0.0.1::8883',
        '--publish',
        '127.0.0.1::9001',
        '--volume',
        `${fixture}:/fixture:ro,Z`,
        '--entrypoint',
        'sh',
        image,
        '-ec',
        'mosquitto_passwd -b -c /tmp/ticlo-test-passwords ticlo "$1" && chmod 644 /tmp/ticlo-test-passwords && exec mosquitto -c /fixture/mosquitto.conf',
        'mosquitto',
        mosquittoPassword,
      ],
      {timeout: 90_000}
    );
    container = start.stdout.trim();
    const deadline = Date.now() + 15_000;
    for (;;) {
      try {
        await exec(engine, ['exec', container, 'mosquitto_pub', '-t', 'test/ready', '-m', 'ready']);
        break;
      } catch (error) {
        const {stdout: running} = await exec(engine, ['inspect', '--format', '{{.State.Running}}', container]);
        if (running.trim() !== 'true' || Date.now() >= deadline) {
          const {stderr} = await exec(engine, ['logs', container]);
          throw new Error(`Mosquitto did not start: ${stderr.trim()}`, {cause: error});
        }
        await delay(100);
      }
    }
    const address = async (port: number) => (await exec(engine, ['port', container, `${port}/tcp`])).stdout.trim();
    const [mqtt, mqtts, wss, ca, cert, key] = await Promise.all([
      address(1883),
      address(8883),
      address(9001),
      readFile(join(fixture, 'ca.crt'), 'utf8'),
      readFile(join(dir, 'client.crt'), 'utf8'),
      readFile(join(dir, 'client.key'), 'utf8'),
    ]);
    return {
      mqtt: `mqtt://${mqtt}`,
      mqtts: `mqtts://${mqtts}`,
      wss: `wss://${wss}/mqtt`,
      ca,
      tlsClientIdentity: createTlsClientIdentity(cert, key),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
