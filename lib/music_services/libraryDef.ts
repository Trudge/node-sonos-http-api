import Fuse from 'fuse.js';
import fs = require('node:fs');
import path = require('node:path');
import settings = require('../../src/settings');
import logger = require('sonos-discovery/lib/helpers/logger');
import type { PlayerLike } from '../../src/types/actions';
import type { MusicService, MusicTrack, TrackList, UriMetadata } from './types';

interface LibraryTrack {
  artistTrackSearch: string;
  artistAlbumSearch: string;
  trackName: string;
  artistName: string;
  albumName: string;
  albumTrackNumber?: number;
  uri: string;
  metadata: string;
}

interface LibraryBrowseItem {
  uri?: string;
  artist?: string;
  album?: string;
  title?: string;
  albumTrackNumber?: number;
}

interface LibraryQueueEntry {
  item: {
    trackName: string;
    artistName: string;
    albumName: string;
    albumTrackNumber?: number;
    uri: string;
    metadata: string;
  };
}

interface BrowseChunk {
  items: LibraryBrowseItem[];
  startIndex: number;
  numberReturned: number;
  totalMatches: number;
}

interface MusicLibrary {
  version: number;
  tracks: {
    items: LibraryTrack[];
    startIndex: number;
    numberReturned: number;
    totalMatches: number;
  };
}

const libraryPath = path.join(settings.cacheDir, 'library.json');
const randomQueueLimit = settings.library && settings.library.randomQueueLimit !== undefined
  ? settings.library.randomQueueLimit
  : 50;
const currentLibVersion = 1.4;

let musicLibrary: MusicLibrary | null = null;
let fuzzyTracks: Fuse<LibraryTrack> | null = null;
let fuzzyAlbums: Fuse<LibraryTrack> | null = null;
let loadPromise: Promise<MusicLibrary> | null = null;

function getTokenHeaders(): null {
  return null;
}

function authenticateService(): Promise<void> {
  return Promise.resolve();
}

function setService(
  _player: PlayerLike,
  _accountId: string,
  _accountSN: string,
  _country: string
): void {
}

function getSearchTerm(
  type: string,
  _term: string,
  artist: string,
  album: string,
  track: string
): string {
  let newTerm = artist;

  if (newTerm !== '' && (artist !== '' || track !== '')) {
    newTerm += ' ';
  }
  newTerm += type === 'album' ? album : track;

  return newTerm;
}

function getMetadata(type: string, id: string | number, name: string): string {
  const token = libraryDef.token;
  const parentUri = (libraryDef.parent[type] || '') + name;
  const objectType = libraryDef.object[type] || '';

  return `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"
          xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
          <item id="${id}" parentID="${parentUri}" restricted="true"><dc:title></dc:title><upnp:class>object.${objectType}</upnp:class>
          <desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">${token}</desc></item></DIDL-Lite>`;
}

function getURIandMetadata(_type: string, resList: unknown): UriMetadata {
  const items = resList as UriMetadata[];
  return { uri: items[0]?.uri || '', metadata: items[0]?.metadata || '' };
}

function loadTracks(type: string, tracksJson: unknown): TrackList {
  const tracks: TrackList = {
    count: 0,
    isArtist: false,
    queueTracks: []
  };
  const entries = tracksJson as LibraryQueueEntry[];

  if (entries.length > 0) {
    const albumName = entries[0].item.albumName;

    tracks.queueTracks = entries.reduce((tracksArray: MusicTrack[], track: LibraryQueueEntry) => {
      if (tracks.count < randomQueueLimit) {
        let skip = false;

        if (type === 'song') {
          skip = tracksArray.some((existing) => existing.trackName === track.item.trackName);
        } else {
          skip = track.item.albumName !== albumName;
        }

        if (!skip) {
          tracksArray.push({
            trackName: track.item.trackName,
            artistName: track.item.artistName,
            albumTrackNumber: track.item.albumTrackNumber,
            uri: track.item.uri,
            metadata: track.item.metadata
          });
          tracks.count += 1;
        }
      }
      return tracksArray;
    }, []);
  }

  if (type === 'album') {
    tracks.queueTracks.sort((a, b) => {
      if (a.artistName !== b.artistName) {
        return a.artistName > b.artistName ? 1 : -1;
      }
      return (a.albumTrackNumber || 0) - (b.albumTrackNumber || 0);
    });
  }

  return tracks;
}

function libIsEmpty(): boolean {
  return musicLibrary === null;
}

async function loadFuse<T>(items: T[], fuzzyKeys: string[]): Promise<Fuse<T>> {
  return new Fuse(items, {
    keys: fuzzyKeys,
    threshold: 0.2,
    ignoreLocation: true
  });
}

function isFinished(chunk: BrowseChunk): boolean {
  return chunk.startIndex + chunk.numberReturned >= chunk.totalMatches;
}

async function loadLibraryFromPlayer(player: PlayerLike): Promise<MusicLibrary> {
  logger.info('Loading Library');
  const library: MusicLibrary = {
    version: currentLibVersion,
    tracks: {
      items: [],
      startIndex: 0,
      numberReturned: 0,
      totalMatches: 1
    }
  };

  const result = library.tracks;
  let chunk = await player.browse('A:TRACKS', 0, 0) as BrowseChunk;

  for (;;) {
    chunk.items.forEach((item: LibraryBrowseItem) => {
      if (item.uri !== undefined && item.artist !== undefined && item.album !== undefined) {
        const metadataId = (libraryDef.metastart.song || '') + item.uri.substring(item.uri.indexOf(':') + 1);
        const metadata = getMetadata(
          'song',
          metadataId,
          `${encodeURIComponent(item.artist)}/${encodeURIComponent(item.album)}`
        );
        result.items.push({
          artistTrackSearch: `${item.artist} ${item.title}`,
          artistAlbumSearch: `${item.artist} ${item.album}`,
          trackName: item.title || '',
          artistName: item.artist,
          albumName: item.album,
          albumTrackNumber: item.albumTrackNumber,
          uri: item.uri,
          metadata
        });
      }
    });

    result.numberReturned += chunk.numberReturned;
    result.totalMatches = chunk.totalMatches;
    logger.info(`Tracks returned: ${result.numberReturned}, Total matches: ${result.totalMatches}`);

    if (isFinished(chunk)) {
      break;
    }

    chunk = await player.browse('A:TRACKS', chunk.startIndex + chunk.numberReturned, 0) as BrowseChunk;
  }

  await fs.promises.writeFile(libraryPath, JSON.stringify(library));
  return library;
}

function loadLibrary(player: PlayerLike | null): Promise<MusicLibrary> {
  if (!player) {
    return Promise.reject(new Error('No player available to load the music library'));
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = loadLibraryFromPlayer(player)
    .catch((error: unknown) => {
      logger.error('Error when recursively trying to load library using browse()', error);
      throw error;
    })
    .finally(() => {
      loadPromise = null;
    });

  return loadPromise;
}

async function buildSearchIndexes(): Promise<void> {
  if (!musicLibrary) {
    return;
  }
  fuzzyTracks = await loadFuse(musicLibrary.tracks.items, ['artistTrackSearch', 'artistName', 'trackName']);
  fuzzyAlbums = await loadFuse(musicLibrary.tracks.items, ['artistAlbumSearch', 'albumName', 'artistName']);
}

async function loadLibrarySearch(player: PlayerLike | null, load: boolean): Promise<string> {
  if (load || musicLibrary === null) {
    musicLibrary = await loadLibrary(player);
    await buildSearchIndexes();
    return 'Library and search loaded';
  }

  await buildSearchIndexes();
  return 'Library search loaded';
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = items.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function searchLibrary(type: string, term: string): unknown {
  const decodedTerm = decodeURIComponent(term);
  if (!fuzzyTracks || !fuzzyAlbums) {
    throw new Error('Library search is not loaded');
  }

  return type === 'album'
    ? fuzzyAlbums.search(decodedTerm)
    : shuffle(fuzzyTracks.search(decodedTerm)).slice(0, randomQueueLimit);
}

function isEmpty(_type: string, resList: unknown): boolean {
  return (resList as unknown[]).length === 0;
}

function handleLibrary(error: NodeJS.ErrnoException | null, data: Buffer): void {
  if (error) {
    return;
  }

  const parsed = JSON.parse(data.toString()) as MusicLibrary;
  if (parsed.version === undefined || parsed.version < currentLibVersion) {
    musicLibrary = null;
    return;
  }

  musicLibrary = parsed;
  void loadLibrarySearch(null, false).catch((err: unknown) => {
    logger.error('Could not load cached library search index', err);
  });
}

function readLibrary(): void {
  fs.readFile(libraryPath, handleLibrary);
}

const libraryDef: MusicService = {
  country: '',
  search: {
    album: '',
    song: '',
    station: ''
  },
  metastart: {
    album: 'S:',
    song: 'S:',
    station: ''
  },
  parent: {
    album: 'A:ALBUMARTIST/',
    song: 'A:ALBUMARTIST/',
    station: ''
  },
  object: {
    album: 'item.audioItem.musicTrack',
    song: 'item.audioItem.musicTrack',
    station: ''
  },
  token: 'RINCON_AssociatedZPUDN',
  service: setService,
  term: getSearchTerm,
  tracks: loadTracks,
  nolib: libIsEmpty,
  read: readLibrary,
  load: loadLibrarySearch,
  searchlib: searchLibrary,
  empty: isEmpty,
  metadata: getMetadata,
  urimeta: getURIandMetadata,
  headers: getTokenHeaders,
  authenticate: authenticateService
};

export = libraryDef;
