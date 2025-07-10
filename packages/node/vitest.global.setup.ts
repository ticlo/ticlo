import {FileStorage} from './storage/FileStorage';

export default function setup() {
  // make sure storage folder is created before running other tests, so they don't conflict at creating the folder
  new FileStorage('./.test-storage/', '.str');
}
