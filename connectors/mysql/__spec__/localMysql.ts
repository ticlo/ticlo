import {localDatabaseAddress} from '../../../tool/local-test-database.ts';

export async function localMysqlUrl(): Promise<string> {
  const password = 'ticlo_test';
  const address = await localDatabaseAddress({
    stateFile: new URL('./mariadb.podman.local.cid', import.meta.url),
    service: 'mariadb',
    image: 'docker.io/library/mariadb:11.8',
    port: 3306,
    env: {MARIADB_ROOT_PASSWORD: password, MARIADB_DATABASE: 'ticlo_test'},
    ready: ['healthcheck.sh', '--connect', '--innodb_initialized'],
  });
  return `mysql://root:${password}@${address}/ticlo_test`;
}
