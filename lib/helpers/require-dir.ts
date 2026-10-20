import fs = require('node:fs');
import path = require('node:path');

function requireDir<T>(directory: string, register: (module: T) => void): void {
  fs.readdirSync(directory)
    .map((name) => {
      const fullPath = path.join(directory, name);
      return { name, fullPath, stat: fs.statSync(fullPath) };
    })
    .filter((file) => !file.stat.isDirectory()
      && !file.name.startsWith('.')
      && (file.name.endsWith('.js') || (file.name.endsWith('.ts') && !file.name.endsWith('.d.ts'))))
    .forEach((file) => {
      register(require(file.fullPath));
    });
}

export = requireDir;
