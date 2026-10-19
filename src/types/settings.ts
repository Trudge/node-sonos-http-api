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
  [key: string]: unknown;
}
