import * as fs from 'fs';

let karmalog: string = fs.readFileSync('coverage/chrome/karma.log', 'utf8');


function replacer(match: string, m1: string, m2: string, m3: string) {
  return `${m1}${parseInt(m2) - 1}${m3}`;

}

let fixedlog = karmalog.replace(/(BRDA:\d+,)(\d+)(,\d+,\d+\n)/g, replacer);

fs.writeFileSync('coverage/chrome/karma.log', fixedlog);
