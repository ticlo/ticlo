// Node-only entry point. Importing it registers database:postgres.
export {PostgresClient, type PostgresOptions} from './PostgresClient.ts';
import './ClientFunction.ts';
