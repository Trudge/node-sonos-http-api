import settings = require('../../src/settings');
import type { PlayerLike } from '../../src/types/actions';
import type { MusicService, MusicTrack, TrackList, UriMetadata } from './types';

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyItem {
  id: string;
  name: string;
  uri: string;
}

interface SpotifyTrack {
  id: string;
  name: string;
  available_markets?: string[];
  artists: Array<{ name: string }>;
}

interface SpotifySearchResponse {
  albums?: { items: SpotifyItem[] };
  artists?: { items: SpotifyItem[] };
  playlists?: { items: SpotifyItem[] };
  tracks?: { items: SpotifyTrack[] };
}

interface SpotifyToken {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

let clientId = '';
let clientSecret = '';

if (settings.spotify) {
  clientId = settings.spotify.clientId || '';
  clientSecret = settings.spotify.clientSecret || '';
}

let clientToken: string | null = null;
let sid: string | number = '';
let serviceType: string | number = '';
let _accountId = '';
let accountSN = '';
let country = '';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

const toBase64 = (value: string): string => Buffer.from(value).toString('base64');

const mapResponse = (response: unknown): SpotifyToken => {
  const token = response as SpotifyTokenResponse;
  return {
    accessToken: token.access_token,
    tokenType: token.token_type,
    expiresIn: token.expires_in
  };
};

function getHeaders(): Record<string, string> {
  if (!clientId || !clientSecret) {
    throw new Error('You are missing spotify clientId and secret in settings.json! Please read the README for instructions on how to generate and add them');
  }
  return {
    Authorization: `Basic ${toBase64(`${clientId}:${clientSecret}`)}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
}

async function auth(): Promise<SpotifyToken> {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: getHeaders(),
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`Unable to authenticate Spotify with client id: ${clientId}`);
  }

  return mapResponse(await response.json());
}

function getTokenHeaders(): Record<string, string> | null {
  if (clientToken === null) {
    return null;
  }
  return {
    Authorization: `Bearer ${clientToken}`
  };
}

async function authenticateService(): Promise<void> {
  const response = await auth();
  clientToken = response.accessToken;
}

function getServiceToken(): string {
  return `SA_RINCON${serviceType}_X_#Svc${serviceType}-0-Token`;
}

function getURI(type: string, id: string): string {
  if (type === 'album') {
    return `x-rincon-cpcontainer:0004206c${id}`;
  }
  if (type === 'song') {
    return `x-sonos-spotify:spotify%3atrack%3a${id}?sid=${sid}&flags=8224&sn=${accountSN}`;
  }
  if (type === 'station') {
    return `x-sonosapi-radio:spotify%3aartistRadio%3a${id}?sid=${sid}&flags=8300&sn=${accountSN}`;
  }
  if (type === 'playlist') {
    return `x-rincon-cpcontainer:0006206c${id}`;
  }
  return '';
}

const spotifyDef: MusicService = {
  country: '&market=',
  search: {
    album: 'https://api.spotify.com/v1/search?type=album&limit=1&q=album:',
    song: 'https://api.spotify.com/v1/search?type=track&limit=50&q=',
    station: 'https://api.spotify.com/v1/search?type=artist&limit=1&q=',
    playlist: 'https://api.spotify.com/v1/search?type=playlist&q='
  },
  metastart: {
    album: '0004206cspotify%3aalbum%3a',
    song: '00032020spotify%3atrack%3a',
    station: '000c206cspotify:artistRadio%3a',
    playlist: '0004206cspotify%3aplaylist%3a'
  },
  parent: {
    album: '00020000album:',
    song: '00020000track:',
    station: '00052064spotify%3aartist%3a',
    playlist: '00020000playlist:'
  },
  object: {
    album: 'container.album.musicAlbum',
    song: 'item.audioItem.musicTrack',
    station: 'item.audioItem.audioBroadcast.#artistRadio',
    playlist: 'container.playlistContainer'
  },
  service: setService,
  term: getSearchTerm,
  tracks: loadTracks,
  empty: isEmpty,
  metadata: getMetadata,
  urimeta: getURIandMetadata,
  headers: getTokenHeaders,
  authenticate: authenticateService
};

function setService(
  player: PlayerLike,
  nextAccountId: string,
  _nextAccountSN: string,
  nextCountry: string
): void {
  sid = player.system.getServiceId('Spotify');
  serviceType = player.system.getServiceType('Spotify');
  _accountId = nextAccountId;
  accountSN = '14';
  country = nextCountry;
}

function getSearchTerm(
  _type: string,
  _term: string,
  artist: string,
  album: string,
  track: string
): string {
  let newTerm = '';

  if (album !== '') {
    newTerm = `${album} `;
  }
  if (artist !== '') {
    newTerm += `artist:${artist}${track !== '' ? ' ' : ''}`;
  }
  if (track !== '') {
    newTerm += `track:${track}`;
  }

  return encodeURIComponent(newTerm);
}

function getMetadata(
  type: string,
  id: string | number,
  name: string,
  title?: string
): string {
  const token = getServiceToken();
  const parentUri = (spotifyDef.parent[type] || '') + name;
  const objectType = spotifyDef.object[type] || '';
  const metadataTitle = type !== 'station' ? '' : (title || '');

  return `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"
          xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
          <item id="${id}" parentID="${parentUri}" restricted="true"><dc:title>${metadataTitle}</dc:title><upnp:class>object.${objectType}</upnp:class>
          <desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">${token}</desc></item></DIDL-Lite>`;
}

function getURIandMetadata(type: string, resList: unknown): UriMetadata {
  const response = resList as SpotifySearchResponse;
  let items: SpotifyItem[] = [];

  if (type === 'album') {
    items = response.albums?.items || [];
  } else if (type === 'station') {
    items = response.artists?.items || [];
  } else if (type === 'playlist') {
    items = response.playlists?.items || [];
  }

  const item = items[0];
  if (!item) {
    return { uri: '', metadata: '' };
  }

  const title = item.name + (type === 'station' ? ' Radio' : '');
  const _name = title.toLowerCase().replace(' radio', '').replace('radio ', '');
  const metadataId = (spotifyDef.metastart[type] || '') + encodeURIComponent(item.id);

  return {
    metadata: getMetadata(
      type,
      metadataId,
      type === 'album' || type === 'playlist' ? title.toLowerCase() : item.id,
      title
    ),
    uri: getURI(type, encodeURIComponent(type === 'station' ? item.id : item.uri))
  };
}

function loadTracks(_type: string, tracksJson: unknown): TrackList {
  const tracks: TrackList = {
    count: 0,
    isArtist: false,
    queueTracks: []
  };
  const response = tracksJson as SpotifySearchResponse;
  const items = response.tracks?.items || [];

  if (items.length > 0) {
    tracks.queueTracks = items.reduce((tracksArray: MusicTrack[], track: SpotifyTrack) => {
      if (track.available_markets == null || track.available_markets.indexOf(country) !== -1) {
        const skip = tracksArray.some((existing) => existing.trackName === track.name);
        if (!skip) {
          const metadataId = (spotifyDef.metastart.song || '') + encodeURIComponent(track.id);
          const metadata = getMetadata('song', metadataId, track.id, track.name);
          const uri = getURI('song', encodeURIComponent(track.id));

          tracksArray.push({
            trackName: track.name,
            artistName: track.artists.length > 0 ? track.artists[0].name : '',
            uri,
            metadata
          });
          tracks.count += 1;
        }
      }
      return tracksArray;
    }, []);
  }

  return tracks;
}

function isEmpty(type: string, resList: unknown): boolean {
  const response = resList as SpotifySearchResponse;
  let count = 0;

  if (type === 'album') {
    count = response.albums?.items.length || 0;
  } else if (type === 'song') {
    count = response.tracks?.items.length || 0;
  } else if (type === 'station') {
    count = response.artists?.items.length || 0;
  } else if (type === 'playlist') {
    count = response.playlists?.items.length || 0;
  }

  return count === 0;
}

export = spotifyDef;
