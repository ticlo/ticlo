// Node-only entry point. Importing it registers tsdb:client.
export {TsdbClient, type TsdbClientOptions} from './TsdbClient.ts';
import './ClientFunction.ts';
