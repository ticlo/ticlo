// Node-only entry point. Importing it registers mysql:client.
export {MysqlClient, type MysqlOptions} from './MysqlClient.ts';
import './ClientFunction.ts';
