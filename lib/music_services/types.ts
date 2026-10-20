export interface MusicTrack {
  trackName: string;
  artistName: string;
  uri: string;
  metadata: string;
  albumTrackNumber?: number;
}

export interface TrackList {
  count: number;
  isArtist: boolean;
  queueTracks: MusicTrack[];
}

export interface UriMetadata {
  uri: string;
  metadata: string;
}

import type { PlayerLike } from '../../src/types/actions';

export interface MusicService {
  country: string;
  search: Record<string, string>;
  metastart: Record<string, string>;
  parent: Record<string, string>;
  object: Record<string, string>;
  token?: string;
  song?: string;
  service(player: PlayerLike, accountId: string, accountSN: string, country: string): void;
  term(type: string, term: string, artist: string, album: string, track: string): string;
  tracks(type: string, json: unknown): TrackList;
  empty(type: string, json: unknown): boolean;
  metadata(type: string, id: string | number, name: string, title?: string): string;
  urimeta(type: string, json: unknown): UriMetadata;
  headers(): Record<string, string> | null;
  authenticate(): Promise<void>;
  init?(flacOn: boolean): MusicService;
  nolib?(): boolean;
  read?(): void;
  load?(player: PlayerLike | null, load: boolean): Promise<unknown>;
  searchlib?(type: string, term: string): unknown;
}
