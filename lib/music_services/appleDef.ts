import type { PlayerLike } from '../../src/types/actions';
import type { MusicService, MusicTrack, TrackList, UriMetadata } from './types';

interface AppleResult {
  collectionId?: string | number;
  collectionName?: string;
  artistId?: string | number;
  artistName?: string;
  id?: string | number;
  name?: string;
  isStreamable?: boolean;
  trackId?: string | number;
  trackName?: string;
}

interface AppleResponse {
  resultCount: number;
  results: AppleResult[];
}

let sid: string | number = '';
let serviceType: string | number = '';
let _accountId = '';
let accountSN = '';
let _country = '';

function getTokenHeaders(): null {
  return null;
}

function authenticateService(): Promise<void> {
  return Promise.resolve();
}

function getServiceToken(): string {
  return `SA_RINCON${serviceType}_X_#Svc${serviceType}-0-Token`;
}

function getURI(type: string, id: string): string {
  if (type === 'album') {
    return `x-rincon-cpcontainer:0004206calbum%3a${id}`;
  }
  if (type === 'song') {
    return `x-sonos-http:song%3a${id}.mp4?sid=${sid}&flags=8224&sn=${accountSN}`;
  }
  if (type === 'station') {
    return `x-sonosapi-radio:radio%3ara.${id}?sid=${sid}&flags=8300&sn=${accountSN}`;
  }
  return '';
}

const appleDef: MusicService = {
  country: '&country=',
  search: {
    album: 'https://itunes.apple.com/search?media=music&limit=1&entity=album&attribute=albumTerm&term=',
    song: 'https://itunes.apple.com/search?media=music&limit=50&entity=song&term=',
    station: 'https://itunes.apple.com/search?media=music&limit=50&entity=musicArtist&term='
  },
  metastart: {
    album: '0004206calbum%3a',
    song: '00032020song%3a',
    station: '000c206cradio%3ara.'
  },
  parent: {
    album: '00020000album:',
    song: '00020000song:',
    station: '00020000radio:'
  },
  object: {
    album: 'container.album.musicAlbum.#AlbumView',
    song: 'item.audioItem.musicTrack.#SongTitleWithArtistAndAlbum',
    station: 'item.audioItem.audioBroadcast'
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
  nextAccountSN: string,
  nextCountry: string
): void {
  sid = player.system.getServiceId('Apple Music');
  serviceType = player.system.getServiceType('Apple Music');
  _accountId = nextAccountId;
  accountSN = nextAccountSN;
  _country = nextCountry;
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
  newTerm = encodeURIComponent(newTerm);
  if (artist !== '') {
    newTerm += '&attribute=artistTerm';
  }
  if (track !== '') {
    newTerm += '&attribute=songTerm';
  }

  return newTerm;
}

function getMetadata(
  type: string,
  id: string | number,
  name: string,
  title?: string
): string {
  const token = getServiceToken();
  const parentUri = (appleDef.parent[type] || '') + name;
  const objectType = appleDef.object[type] || '';
  const metadataTitle = type === 'station' ? `${title || ''} Radio` : '';

  return `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"
          xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
          <item id="${id}" parentID="${parentUri}" restricted="true"><dc:title>${metadataTitle}</dc:title><upnp:class>object.${objectType}</upnp:class>
          <desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">${token}</desc></item></DIDL-Lite>`;
}

function getURIandMetadata(type: string, resList: unknown): UriMetadata {
  const response = resList as AppleResponse;
  let id: string | number = '';
  let title = '';

  if (type === 'album') {
    id = response.results[0].collectionId || '';
    title = response.results[0].collectionName || '';
  } else if (type === 'station') {
    id = response.results[0].artistId || '';
    title = response.results[0].artistName || '';
  } else {
    id = response.results[0].id || '';
    title = response.results[0].name || '';
  }

  const name = String(title).toLowerCase().replace(' radio', '').replace('radio ', '').replace("'", '&apos;');
  const metadataId = (appleDef.metastart[type] || '') + encodeURIComponent(String(id));

  return {
    metadata: getMetadata(type, metadataId, name, title),
    uri: getURI(type, encodeURIComponent(String(id)))
  };
}

function loadTracks(_type: string, tracksJson: unknown): TrackList {
  const tracks: TrackList = {
    count: 0,
    isArtist: false,
    queueTracks: []
  };
  const response = tracksJson as AppleResponse;

  if (response.resultCount > 0) {
    tracks.queueTracks = response.results.reduce((tracksArray: MusicTrack[], track: AppleResult) => {
      if (track.isStreamable) {
        const skip = tracksArray.some((existing) => existing.trackName === track.trackName);
        if (!skip) {
          const trackId = String(track.trackId ?? '');
          const metadataId = (appleDef.metastart.song || '') + encodeURIComponent(trackId);
          const metadata = getMetadata('song', metadataId, trackId, track.trackName);
          const uri = getURI('song', encodeURIComponent(trackId));

          tracksArray.push({
            trackName: track.trackName || '',
            artistName: track.artistName || '',
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

function isEmpty(_type: string, resList: unknown): boolean {
  return (resList as AppleResponse).resultCount === 0;
}

export = appleDef;
