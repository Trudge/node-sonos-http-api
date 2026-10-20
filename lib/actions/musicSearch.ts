import type { ActionApi, PlayerLike } from '../../src/types/actions';
import type { MusicService, MusicTrack, TrackList } from '../music_services/types';
import appleDef = require('../music_services/appleDef');
import spotifyDef = require('../music_services/spotifyDef');
import deezerDef = require('../music_services/deezerDef');
import libraryDef = require('../music_services/libraryDef');

const eliteDef = deezerDef.init ? deezerDef.init(true) : deezerDef;
const musicServices = ['apple', 'spotify', 'deezer', 'elite', 'library'];
const musicTypes = ['album', 'song', 'station', 'load', 'playlist'];
const serviceNames: Record<string, string> = {
  apple: 'Apple Music',
  spotify: 'Spotify',
  deezer: 'Deezer',
  elite: 'Deezer',
  library: 'Library'
};

const serviceDefinitions: Record<string, MusicService> = {
  apple: appleDef,
  spotify: spotifyDef,
  deezer: deezerDef,
  elite: eliteDef,
  library: libraryDef
};

interface AccountInfo {
  accountId: string;
  accountSN: string;
}

interface SearchOutcome {
  resList: unknown;
  searchType: number;
}

let country = '';

function getService(service: string): MusicService {
  const definition = serviceDefinitions[service];
  if (!definition) {
    throw new Error(`Invalid music service: ${service}`);
  }
  return definition;
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = items.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.text();
}

async function getAccountId(player: PlayerLike, service: string): Promise<AccountInfo> {
  if (service === 'library') {
    return { accountId: '', accountSN: '' };
  }

  const response = await fetchText(`${player.baseUrl}/status/accounts`);
  const serviceType = player.system.getServiceType(serviceNames[service]);
  let accountId = '';
  let accountSN = '';
  const accountLocation = response.indexOf(String(serviceType));

  if (accountLocation !== -1) {
    const idLocation = response.indexOf('<UN>', accountLocation) + 4;
    const serialLocation = response.indexOf('SerialNum="', accountLocation) + 11;
    accountId = response.substring(idLocation, response.indexOf('</UN>', idLocation));
    accountSN = response.substring(serialLocation, response.indexOf('"', serialLocation));
  }

  return { accountId, accountSN };
}

async function doSearch(service: string, type: string, term: string): Promise<SearchOutcome> {
  const serviceDef = getService(service);
  let url = serviceDef.search[type] || '';
  const decodedTerm = decodeURIComponent(term);
  let searchType = 0;
  let newTerm: string;

  if (decodedTerm.includes(':')) {
    const artistPos = decodedTerm.indexOf('artist:');
    const albumPos = decodedTerm.indexOf('album:');
    const trackPos = decodedTerm.indexOf('track:');
    let nextPos = -1;
    let artist = '';
    let album = '';
    let track = '';

    if (artistPos > -1) {
      nextPos = albumPos < trackPos ? albumPos : trackPos;
      artist = decodedTerm.substring(artistPos + 7, artistPos < nextPos ? nextPos : decodedTerm.length);
    }
    if (albumPos > -1) {
      nextPos = trackPos < artistPos ? trackPos : artistPos;
      album = decodedTerm.substring(albumPos + 6, albumPos < nextPos ? nextPos : decodedTerm.length);
    }
    if (trackPos > -1) {
      nextPos = albumPos < artistPos ? albumPos : artistPos;
      track = decodedTerm.substring(trackPos + 6, trackPos < nextPos ? nextPos : decodedTerm.length);
    }

    newTerm = serviceDef.term(type, decodedTerm, artist, album, track);
    if (type === 'song') {
      searchType = trackPos > -1 ? 1 : (artistPos > -1 ? 2 : 0);
    }
  } else {
    newTerm = service === 'library' ? decodedTerm : encodeURIComponent(decodedTerm);
  }

  url += newTerm;

  if (service === 'library') {
    if (!libraryDef.searchlib) {
      throw new Error('Library search is not available');
    }
    return { resList: libraryDef.searchlib(type, newTerm), searchType };
  }

  if (serviceDef.country !== '' && country === '') {
    const location = await fetchJson<{ country: string }>('https://ipinfo.io/json');
    country = location.country;
  }

  if (serviceDef.country !== '') {
    url += serviceDef.country + country;
  }

  await serviceDef.authenticate();
  const resList = await fetchJson(url, serviceDef.headers() || {});
  return { resList, searchType };
}

function loadTracks(
  player: PlayerLike,
  service: string,
  type: string,
  tracksJson: unknown,
  searchType: number
): TrackList {
  const tracks = getService(service).tracks(type, tracksJson);

  if (service === 'library' && type === 'album') {
    tracks.isArtist = true;
  } else if (type !== 'album') {
    if (searchType === 0) {
      if (tracks.count > 1) {
        let artistCount = 1;
        let trackCount = 1;
        const artists = tracks.queueTracks.map((track) => track.artistName.toLowerCase()).sort();
        const songs = tracks.queueTracks.map((track) => track.trackName.toLowerCase()).sort();

        let previousArtist = artists[0];
        let previousTrack = songs[0];

        for (let index = 1; index < tracks.count; index += 1) {
          if (artists[index] !== previousArtist) {
            artistCount += 1;
            previousArtist = artists[index];
          }
          if (songs[index] !== previousTrack) {
            trackCount += 1;
            previousTrack = songs[index];
          }
        }
        tracks.isArtist = trackCount / artistCount > 2;
      }
    } else {
      tracks.isArtist = searchType === 2;
    }
  }

  if (tracks.isArtist && player.coordinator.state.playMode.shuffle) {
    tracks.queueTracks = shuffle(tracks.queueTracks);
  }

  return tracks;
}

async function enqueueArtistTracks(
  player: PlayerLike,
  tracks: MusicTrack[]
): Promise<void> {
  await player.coordinator.clearQueue();
  await player.coordinator.setAVTransport(`x-rincon-queue:${player.coordinator.uuid}#0`, '');
  await player.coordinator.addURIToQueue(tracks[0].uri, tracks[0].metadata, true, 1);
  await player.coordinator.play();

  void tracks.slice(1).reduce(
    (promise: Promise<unknown>, track: MusicTrack, index: number) => promise.then(
      () => player.coordinator.addURIToQueue(track.uri, track.metadata, true, index + 2)
    ),
    Promise.resolve()
  );
}

async function musicSearch(player: PlayerLike, values: string[]): Promise<unknown> {
  const service = values[0];
  const type = values[1];
  const term = values[2];

  if (!service || !type || !term) {
    throw new Error('Expected service, type, and search term');
  }
  if (!musicServices.includes(service)) {
    throw new Error('Invalid music service');
  }
  if (!musicTypes.includes(type)) {
    throw new Error(`Invalid type ${type}`);
  }

  if (service === 'library' && (type === 'load' || (libraryDef.nolib?.()))) {
    if (!libraryDef.load) {
      throw new Error('Library loading is not available');
    }
    return libraryDef.load(player, type === 'load');
  }

  const account = await getAccountId(player, service);
  const { resList, searchType } = await doSearch(service, type, term);
  const serviceDef = getService(service);
  serviceDef.service(player, account.accountId, account.accountSN, country);

  if (serviceDef.empty(type, resList)) {
    throw new Error('No matches were found');
  }

  const queueUri = `x-rincon-queue:${player.coordinator.uuid}#0`;

  if (type === 'station') {
    const uriMetadata = serviceDef.urimeta(type, resList);
    await player.coordinator.setAVTransport(uriMetadata.uri, uriMetadata.metadata);
    await player.coordinator.play();
    return undefined;
  }

  if ((type === 'album' || type === 'playlist') && service !== 'library') {
    const uriMetadata = serviceDef.urimeta(type, resList);
    await player.coordinator.clearQueue();
    await player.coordinator.setAVTransport(queueUri, '');
    await player.coordinator.addURIToQueue(uriMetadata.uri, uriMetadata.metadata, true, 1);
    await player.coordinator.play();
    return undefined;
  }

  const tracks = loadTracks(player, service, type, resList, searchType);
  if (tracks.count === 0) {
    throw new Error('No matches were found');
  }

  if (tracks.isArtist) {
    await enqueueArtistTracks(player, tracks.queueTracks);
    return undefined;
  }

  const [track] = tracks.queueTracks;
  const queue = await player.coordinator.getQueue(0, 1);
  const empty = queue.length === 0;
  const nextTrackNo = empty ? 1 : player.coordinator.state.trackNo + 1;

  await player.coordinator.addURIToQueue(track.uri, track.metadata, true, nextTrackNo);
  await player.coordinator.setAVTransport(queueUri, '');
  if (!empty) {
    await player.coordinator.nextTrack();
  }
  await player.coordinator.play();
  return undefined;
}

export = function (api: ActionApi): void {
  api.registerAction('musicsearch', musicSearch);
  if (libraryDef.read) {
    libraryDef.read();
  }
};
