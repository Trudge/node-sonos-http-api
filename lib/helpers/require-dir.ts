'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function (cwd: any, cb: any) {
  let files = fs.readdirSync(cwd);

  files.map((name: any) => {
    let fullPath = path.join(cwd, name);
    return {
      name,
      fullPath,
      stat: fs.statSync(fullPath)
    };
  }).filter((file: any) => {
    return !file.stat.isDirectory() && !file.name.startsWith('.') && (file.name.endsWith('.js') || (file.name.endsWith('.ts') && !file.name.endsWith('.d.ts')));
  }).forEach((file: any) => {
    cb(require(file.fullPath));
  });
};
