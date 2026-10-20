import path = require('node:path');
import requireDir = require('sonos-discovery/lib/helpers/require-dir');
import google = require('../tts-providers/default/google');

interface TtsResult {
  duration: number;
  uri: string;
}

type TtsProvider = (
  phrase: string,
  language?: string
) => Promise<TtsResult | undefined>;

const providers: TtsProvider[] = [];

requireDir(path.join(__dirname, '../tts-providers'), (provider: TtsProvider) => {
  providers.push(provider);
});

providers.push(google);

async function tryDownloadTTS(
  phrase: string,
  language?: string
): Promise<TtsResult | undefined> {
  for (const provider of providers) {
    const result = await provider(phrase, language);
    if (result) return result;
  }
  return undefined;
}

export = tryDownloadTTS;
