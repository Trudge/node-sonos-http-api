import type { PlayerLike } from '../../src/types/actions';
import type { MusicService, MusicTrack, TrackList, UriMetadata } from './types';

interface DeezerItem {
  id: string | number;
  title?: string;
  artist?: { id: string | number; name: string };
  album?: { id: string | number; title: string };
}

interface DeezerResponse {
  data: DeezerItem[];
}

let sid: string | number = '';
let serviceType: string | number = '';
let accountId = '';
let accountSN = '';
let _country = '';

function getTokenHeaders(): null {
  return null;
}

function authenticateService(): Promise<void> {
  return Promise.resolve();
}

function getServiceToken(): string {
  return `SA_RINCON${serviceType}_${accountId}`;
}

function getURI(type: string, id: string): string {
  if (type === 'album') {
    return `x-rincon-cpcontainer:0004006calbum-${id}`;
  }
  if (type === 'song') {
    return `x-sonos-http:tr%3a${id}.mp3?sid=${sid}&flags=8224&sn=${accountSN}`;
  }
  if (type === 'station') {
    return `x-sonosapi-radio:radio-artist-${id}?sid=${sid}&flags=104&sn=${accountSN}`;
  }
  return '';
}

function init(flacOn: boolean): MusicService {
  deezerDef.song = flacOn ? '00032020tr-flac%3a' : '00032020tr%3a';
  return deezerDef;
}

const deezerDef: MusicService = {
  country: '',
  song: '',
  search: {
    album: 'https://api.deezer.com/search?limit=1&q=album:',
    song: 'https://api.deezer.com/search?limit=50&q=',
    station: 'https://api.deezer.com/search?limit=1&q=artist:'
  },
  metastart: {
    album: '0004006calbum-',
    song: '00032020tr%3a',
    station: '000c0068radio-artist-'
  },
  parent: {
    album: '00020000search-album:',
    song: '00020000search-track:',
    station: '00050064artist-'
  },
  object: {
    album: 'container.album.musicAlbum.#DEFAULT',
    song: 'item.audioItem.musicTrack.#DEFAULT',
    station: 'item.audioItem.audioBroadcast.#DEFAULT'
  },
  init,
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
  nextAccountSN: string,
  nextCountry: string
): void {
  sid = player.system.getServiceId('Deezer');
  serviceType = player.system.getServiceType('Deezer');
  accountId = nextAccountId;
  accountSN = nextAccountSN;
  _country = nextCountry;
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
  const parentUri = (deezerDef.parent[type] || '') + name;
  const objectType = deezerDef.object[type] || '';
  const metadataTitle = type !== 'station' ? '' : (title || '');

  return `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"
          xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
          <item id="${id}" parentID="${parentUri}" restricted="true"><dc:title>${metadataTitle}</dc:title><upnp:class>object.${objectType}</upnp:class>
          <desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">${token}</desc></item></DIDL-Lite>`;
}

function getURIandMetadata(type: string, resList: unknown): UriMetadata {
  const response = resList as DeezerResponse;
  const item = response.data[0];
  const id = type === 'album' ? item.album?.id || '' : item.artist?.id || '';
  const title = type === 'album'
    ? item.album?.title || ''
    : `${item.artist?.name || ''} Radio`;
  const _name = String(title).toLowerCase().replace(' radio', '').replace('radio ', '').replace("'", '&apos;');
  const metadataId = (deezerDef.metastart[type] || '') + encodeURIComponent(String(id));

  return {
    metadata: getMetadata(type, metadataId, String(id), title),
    uri: getURI(type, encodeURIComponent(String(id)))
  };
}

function loadTracks(_type: string, tracksJson: unknown): TrackList {
  const tracks: TrackList = {
    count: 0,
    isArtist: false,
    queueTracks: []
  };
  const response = tracksJson as DeezerResponse;

  if (response.data.length > 0) {
    tracks.queueTracks = response.data.reduce((tracksArray: MusicTrack[], track: DeezerItem) => {
      const skip = tracksArray.some((existing) => existing.trackName === track.title);
      if (!skip) {
        const title = track.title || '';
        const metadataId = (deezerDef.metastart.song || '') + encodeURIComponent(track.id);
        const metadata = getMetadata('song', metadataId, title.toLowerCase(), title);
        const uri = getURI('song', encodeURIComponent(track.id));

        tracksArray.push({
          trackName: title,
          artistName: track.artist?.name || '',
          uri,
          metadata
        });
        tracks.count += 1;
      }
      return tracksArray;
    }, []);
  }

  return tracks;
}

function isEmpty(_type: string, resList: unknown): boolean {
  return (resList as DeezerResponse).data.length === 0;
}

export = deezerDef;
