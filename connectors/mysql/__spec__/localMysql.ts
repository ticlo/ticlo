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

export async function localMysql84Url(): Promise<string> {
  const password = 'ticlo_test';
  const address = await localDatabaseAddress({
    stateFile: new URL('./mysql84.podman.local.cid', import.meta.url),
    service: 'mysql84',
    image: 'docker.io/library/mysql:8.4',
    port: 3306,
    env: {MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'ticlo_test'},
    ready: ['mysqladmin', 'ping', '-h', '127.0.0.1'],
  });
  return `mysql://root:${password}@${address}/ticlo_test`;
}
