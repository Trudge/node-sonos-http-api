export interface AuthSettings {
  username: string;
  password: string;
}

export interface HttpsSettings {
  key?: string;
  cert?: string;
  pfx?: string;
  passphrase?: string;
}

export interface AwsPollySettings {
  name?: string;
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}

export interface ElevenLabsSettings {
  auth?: { apiKey?: string };
  config?: {
    voiceId?: string;
    modelId?: string;
    stability?: number;
    similarityBoost?: number;
    speakerBoost?: boolean;
    style?: number;
  };
}

export interface MacSaySettings {
  rate?: string | number;
  voice?: string;
}

export interface MicrosoftSettings {
  key?: string;
  name?: string;
}

export interface SpotifySettings {
  clientId?: string;
  clientSecret?: string;
}

export interface LibrarySettings {
  randomQueueLimit?: number;
}

export interface Settings {
  port: number;
  ip: string;
  securePort: number;
  cacheDir: string;
  webroot: string;
  presetDir: string;
  announceVolume: number;
  auth?: AuthSettings;
  cors?: string | string[];
  https?: HttpsSettings;
  webhook?: string;
  webhookType?: string;
  webhookData?: string;
  webhookHeaderName?: string;
  webhookHeaderContents?: string;
  aws?: AwsPollySettings;
  elevenlabs?: ElevenLabsSettings;
  macSay?: MacSaySettings;
  microsoft?: MicrosoftSettings;
  voicerss?: string;
  spotify?: SpotifySettings;
  library?: LibrarySettings;
  [key: string]: unknown;
}
