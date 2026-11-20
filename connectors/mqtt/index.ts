// Node-only entry point. Importing it registers the MQTT functions.
export {MqttClient, type MqttOptions, type MqttTarget} from './MqttClient.ts';
export type {MqttService} from './ClientFunction.ts';
import './Functions.ts';
