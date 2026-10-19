let parseFilePromise;

function getParseFile() {
  if (!parseFilePromise) {
    parseFilePromise = import('music-metadata').then((module) => module.parseFile);
  }
  return parseFilePromise;
}

function fileDuration(path) {
  return getParseFile()
    .then((parseFile) => parseFile(path, { duration: true }))
    .then((info) => Math.ceil(info.format.duration * 1000));
}

module.exports = fileDuration;
