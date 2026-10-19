type ParseFile = (path: string, options: any) => Promise<any>;

let parseFilePromise: Promise<ParseFile> | undefined;

function getParseFile(): Promise<ParseFile> {
  if (!parseFilePromise) {
    parseFilePromise = import('music-metadata').then((module) => module.parseFile as ParseFile);
  }
  return parseFilePromise;
}

function fileDuration(path: string): Promise<number> {
  return getParseFile()
    .then((parseFile) => parseFile(path, { duration: true }))
    .then((info) => Math.ceil(info.format.duration * 1000));
}

export = fileDuration;
