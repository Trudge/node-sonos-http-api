type ParseFile = (
  filePath: string,
  options: { duration?: boolean }
) => Promise<{ format: { duration?: number } }>;

let parseFilePromise: Promise<ParseFile> | undefined;

function getParseFile(): Promise<ParseFile> {
  if (!parseFilePromise) {
    parseFilePromise = import('music-metadata')
      .then((module) => module.parseFile);
  }
  return parseFilePromise;
}

async function fileDuration(filePath: string): Promise<number> {
  const parseFile = await getParseFile();
  const info = await parseFile(filePath, { duration: true });
  const duration = info.format.duration;
  if (duration === undefined) {
    throw new Error(`Could not determine the duration of ${filePath}`);
  }
  return Math.ceil(duration * 1000);
}

export = fileDuration;
