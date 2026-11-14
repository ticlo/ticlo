// Node-only entry point. Importing it registers database:mysql.
export {MysqlClient, type MysqlOptions} from './MysqlClient.ts';
import './ClientFunction.ts';
