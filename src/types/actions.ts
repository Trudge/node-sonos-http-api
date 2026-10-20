export interface PlayMode {
  repeat: string;
  shuffle: boolean;
  crossfade: boolean;
}

export interface EqualizerState {
  nightMode: boolean;
  speechEnhancement: boolean;
  bass?: number;
  treble?: number;
  loudness?: boolean;
}

export interface PlayerState {
  volume: number;
  mute: boolean;
  playbackState: string;
  trackNo: number;
  elapsedTime: number;
  playMode: PlayMode;
  equalizer: EqualizerState;
  [key: string]: unknown;
}

export interface MediaItem {
  title?: string;
  artist?: string;
  album?: string;
  albumArtUri?: string;
  uri?: string;
  metadata?: string;
  [key: string]: unknown;
}

export interface EnqueueResult {
  firsttracknumberenqueued: number;
  [key: string]: unknown;
}

export interface PlayerLike {
  uuid: string;
  roomName: string;
  baseUrl: string;
  state: PlayerState;
  coordinator: PlayerLike;
  system: SonosSystemLike;
  hasSub?: boolean;
  outputFixed?: boolean;
  avTransportUri: string;
  avTransportUriMetadata?: unknown;
  enqueuedTransportUri?: string;
  enqueuedTransportUriMetadata?: unknown;
  currentPlayMode?: unknown;
  groupState?: unknown;
  airPlayEnabled?: unknown;
  micEnabled?: boolean;
  wifiEnabled?: unknown;
  wirelessMode?: unknown;
  roomCalibrationState?: unknown;
  hdmiCecAvailable?: unknown;
  _state?: unknown;
  play(): Promise<unknown>;
  pause(): Promise<unknown>;
  stop(): Promise<unknown>;
  nextTrack(): Promise<unknown>;
  previousTrack(): Promise<unknown>;
  mute(): Promise<unknown>;
  unMute(): Promise<unknown>;
  muteGroup(): Promise<unknown>;
  unMuteGroup(): Promise<unknown>;
  setVolume(level: string | number): Promise<unknown>;
  setGroupVolume(level: string | number): Promise<unknown>;
  setBass(level: number): Promise<unknown>;
  setTreble(level: number): Promise<unknown>;
  timeSeek(seconds: string | number): Promise<unknown>;
  trackSeek(trackNo: number): Promise<unknown>;
  clearQueue(): Promise<unknown>;
  addURIToQueue(
    uri: string,
    metadata: unknown,
    enqueueAsNext?: boolean,
    desiredFirstTrackNumberEnqueued?: number
  ): Promise<EnqueueResult>;
  setAVTransport(uri: string, metadata?: unknown): Promise<unknown>;
  repeat(mode: string): Promise<unknown>;
  shuffle(enabled: boolean): Promise<unknown>;
  crossfade(enabled: boolean): Promise<unknown>;
  sleep(seconds: string | number): Promise<unknown>;
  becomeCoordinatorOfStandaloneGroup(): Promise<unknown>;
  browse(objectId: string, startIndex: number, limit: number): Promise<unknown>;
  getQueue(limit?: number, offset?: number): Promise<MediaItem[]>;
  replaceWithFavorite(name: string): Promise<unknown>;
  replaceWithPlaylist(name: string): Promise<unknown>;
  nightMode(enabled: boolean): Promise<unknown>;
  speechEnhancement(enabled: boolean): Promise<unknown>;
  subEnable(): Promise<unknown>;
  subDisable(): Promise<unknown>;
  subGain(value: string): Promise<unknown>;
  subCrossover(value: string): Promise<unknown>;
  subPolarity(value: string): Promise<unknown>;
  on(event: string, listener: (...args: never[]) => void): this;
  once(event: string, listener: (...args: never[]) => void): this;
  removeListener(event: string, listener: (...args: never[]) => void): this;
  [key: string]: unknown;
}

export interface ZoneGroupLike {
  uuid: string;
  id?: string;
  coordinator: PlayerLike;
  members: PlayerLike[];
  [key: string]: unknown;
}

export interface ServiceInfo {
  id: number;
  type: number;
  capabilities: number;
}

export interface SonosSystemLike {
  zones: ZoneGroupLike[];
  players: PlayerLike[];
  localEndpoint: string;
  availableServices: Record<string, ServiceInfo>;
  getPlayer(name: string): PlayerLike | undefined;
  getAnyPlayer(): PlayerLike | undefined;
  getPlayerByUUID(uuid: string): PlayerLike;
  getFavorites(): Promise<MediaItem[]>;
  getPlaylists(): Promise<MediaItem[]>;
  getServiceId(name: string): string | number;
  getServiceType(name: string): string | number;
  applyPreset(preset: unknown): Promise<unknown>;
  refreshShareIndex(): Promise<unknown>;
  on(event: string, listener: (...args: never[]) => void): this;
  once(event: string, listener: (...args: never[]) => void): this;
  removeListener(event: string, listener: (...args: never[]) => void): this;
  [key: string]: unknown;
}

export type ActionHandler = (
  player: PlayerLike,
  values: string[]
) => Promise<unknown> | unknown;

export interface ActionApi {
  registerAction(name: string, handler: ActionHandler): void;
  getPort(): number;
  getWebRoot(): string;
  discovery: SonosSystemLike;
}
