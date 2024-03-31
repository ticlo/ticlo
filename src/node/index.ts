import {setStorageFunctionProvider} from '../core/functions/data/Storage';
import {FileStorage, FileFlowStorage} from './storage/FileStorage';

export {WsServerConnection} from './connect/WsServerConnection';
export {FileFlowStorage, FileStorage};

setStorageFunctionProvider(() => new FileStorage('./.storage/', '.str'));
