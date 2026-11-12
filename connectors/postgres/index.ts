// Node-only entry point. Importing it registers postgres:client.
export {PostgresClient, type PostgresOptions} from './PostgresClient.ts';
import './ClientFunction.ts';
