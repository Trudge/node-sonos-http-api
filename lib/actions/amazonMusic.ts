import type { ActionApi, PlayerLike } from '../../src/types/actions';

function getMetadata(id: string, parentUri: string, type: string, title: string): string {
  return `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
<item id="${id}" parentID="${parentUri}" restricted="true">
  <dc:title>"${title}"</dc:title>
  <upnp:class>${type}</upnp:class>
  <desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON51463_X_#Svc51463-0-Token</desc>
</item>
</DIDL-Lite>`;
}

function getSongUri(id: string): string {
  return `x-sonosapi-hls-static:catalog%2ftracks%2f${id}%2f%3falbumAsin%3dB01JDKZWK0?sid=201&flags=0&sn=4`;
}

function getAlbumUri(id: string): string {
  return `x-rincon-cpcontainer:1004206ccatalog%2falbums%2f${id}%2f%23album_desc?sid=201&flags=8300&sn=4`;
}

const uriTemplates: Record<string, (id: string) => string> = {
  song: getSongUri,
  album: getAlbumUri
};

const classes: Record<string, string> = {
  song: 'object.container.album.musicAlbum.#AlbumView',
  album: 'object.container.album.musicAlbum'
};

const metadataUriStarters: Record<string, string> = {
  song: '10030000catalog%2ftracks%2f',
  album: '1004206ccatalog'
};

const metadataUriEndings: Record<string, string> = {
  song: '%2f%3falbumAsin%3d',
  album: '%2f%23album_desc'
};

const parents: Record<string, string> = {
  song: '1004206ccatalog%2falbums%2f',
  album: '10052064catalog%2fartists%2f'
};

async function amazonMusic(player: PlayerLike, values: string[]): Promise<unknown> {
  const action = values[0];
  const track = values[1];

  if (!action || !track) {
    throw new Error('Expected action and Amazon Music track');
  }

  const [type, trackId] = track.split(':');
  const uriTemplate = uriTemplates[type];
  const objectClass = classes[type];
  const metadataStarter = metadataUriStarters[type];
  const metadataEnding = metadataUriEndings[type];
  const parent = parents[type];

  if (!trackId || !uriTemplate || !objectClass || !metadataStarter || !metadataEnding || !parent) {
    throw new Error(`Unsupported Amazon Music track type: ${type}`);
  }

  const encodedTrackId = encodeURIComponent(trackId);
  const metadataId = metadataStarter + encodedTrackId + metadataEnding;
  const metadata = getMetadata(metadataId, parent, objectClass, '');
  const uri = uriTemplate(encodedTrackId);
  const nextTrackNo = player.coordinator.state.trackNo + 1;

  if (action === 'queue') {
    return player.coordinator.addURIToQueue(uri, metadata);
  }

  if (action === 'now') {
    if (!player.coordinator.avTransportUri.startsWith('x-rincon-queue')) {
      await player.coordinator.setAVTransport(`x-rincon-queue:${player.coordinator.uuid}#0`);
    }
    await player.coordinator.addURIToQueue(uri, metadata, true, nextTrackNo);
    if (nextTrackNo !== 1) {
      await player.coordinator.nextTrack();
    }
    await player.coordinator.play();
    return undefined;
  }

  if (action === 'next') {
    return player.coordinator.addURIToQueue(uri, metadata, true, nextTrackNo);
  }

  throw new Error('Amazon Music only handles the {queue, now, next} actions');
}

export = function (api: ActionApi): void {
  api.registerAction('amazonmusic', amazonMusic);
};
