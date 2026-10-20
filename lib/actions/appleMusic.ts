import type { ActionApi, PlayerLike } from '../../src/types/actions';

function getMetadata(id: string, parentUri: string, type: string, title: string): string {
  return `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"
  xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
  <item id="${id}" parentID="${parentUri}" restricted="true"><dc:title>"${title}"</dc:title><upnp:class>${type}</upnp:class>
  <desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON52231_X_#Svc52231-0-Token</desc></item></DIDL-Lite>`;
}

function getSongUri(id: string): string {
  return `x-sonos-http:${id}.mp4?sid=204&flags=8224&sn=4`;
}

function getAlbumUri(id: string): string {
  return `x-rincon-cpcontainer:0004206c${id}`;
}

function getPlaylistUri(id: string): string {
  return `x-rincon-cpcontainer:1006206c${id}`;
}

const uriTemplates: Record<string, (id: string) => string> = {
  song: getSongUri,
  album: getAlbumUri,
  playlist: getPlaylistUri
};

const classes: Record<string, string> = {
  song: 'object.item.audioItem.musicTrack',
  album: 'object.item.audioItem.musicAlbum',
  playlist: 'object.container.playlistContainer.#PlaylistView'
};

const metadataUriStarters: Record<string, string> = {
  song: '00032020',
  album: '0004206c',
  playlist: '1006206c'
};

const parents: Record<string, string> = {
  song: '0004206calbum%3a',
  album: '00020000album%3a',
  playlist: '1006206cplaylist%3a'
};

async function appleMusic(player: PlayerLike, values: string[]): Promise<unknown> {
  const action = values[0];
  const track = values[1];

  if (!action || !track) {
    throw new Error('Expected action and Apple Music track');
  }

  const type = track.split(':')[0];
  const uriTemplate = uriTemplates[type];
  const objectClass = classes[type];
  const metadataStarter = metadataUriStarters[type];
  const parent = parents[type];

  if (!uriTemplate || !objectClass || !metadataStarter || !parent) {
    throw new Error(`Unsupported Apple Music track type: ${type}`);
  }

  const encodedTrack = encodeURIComponent(track);
  const metadataId = metadataStarter + encodedTrack;
  const metadata = getMetadata(metadataId, parent, objectClass, '');
  const uri = uriTemplate(encodedTrack);
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

  throw new Error('Apple Music only handles the {queue, now, next} actions');
}

export = function (api: ActionApi): void {
  api.registerAction('applemusic', appleMusic);
};
