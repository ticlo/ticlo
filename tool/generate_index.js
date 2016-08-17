"use strict";

const Fs = require('fs');
const Path = require('path');

let srcPath = Path.resolve(__dirname, '../src');

let outputs = [];
function readTs(folder, file) {

}

function readFolder(folder, foldername) {
    for (let str of Fs.readdirSync(folder)) {
        if (str.endsWith('.ts')) {
            outputs.push('\/\/\/ <reference path="'+foldername+str+'" />');
        } else if (!str.includes('.')){
            readFolder(folder + '/' + str, foldername+ str+ '/' );
        }
    }
    outputs.push('');
}

readFolder(Path.resolve(srcPath, 'util'), 'util/');
readFolder(Path.resolve(srcPath, 'core'),'core/');
readFolder(Path.resolve(srcPath, 'logic'),'logic/');


Fs.writeFileSync(Path.resolve(srcPath, 'breezeflow.ts'), outputs.join('\n') );