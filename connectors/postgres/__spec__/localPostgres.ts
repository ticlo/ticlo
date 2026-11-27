import {localDatabaseAddress} from '../../../tool/local-test-database.ts';

export async function localPostgresUrl(): Promise<string> {
  const password = 'ticlo_test';
  const address = await localDatabaseAddress({
    stateFile: new URL('./postgres.podman.local.cid', import.meta.url),
    service: 'postgres',
    image: 'docker.io/library/postgres:18',
    port: 5432,
    env: {POSTGRES_PASSWORD: password, POSTGRES_HOST_AUTH_METHOD: 'scram-sha-256'},
    ready: ['pg_isready', '-h', '127.0.0.1'],
  });
  return `postgresql://postgres:${password}@${address}/postgres`;
}
