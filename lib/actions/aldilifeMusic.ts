import type { ActionApi, PlayerLike } from '../../src/types/actions';

function getMetadata(id: string, parentUri: string, type: string, title: string): string {
  return `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"
  xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
  <item id="${id}" parentID="${parentUri}" restricted="true"><dc:title>"${title}"</dc:title><upnp:class>${type}</upnp:class>
  <desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON55303_X_#Svc55303-0-Token</desc></item></DIDL-Lite>`;
}

function getUri(id: string, type: string): string {
  const uris: Record<string, string> = {
    song: `x-sonos-http:ondemand_track%3a%3atra.${id}%7cv1%7cALBUM%7calb.mp4?sid=216&flags=8224&sn=13`,
    album: `x-rincon-cpcontainer:100420ecexplore%3aalbum%3a%3aAlb.${id}`
  };
  return uris[type] || '';
}

const classes: Record<string, string> = {
  song: 'object.item.audioItem.musicTrack',
  album: 'object.container.album.musicAlbum'
};

const metadataUriStarters: Record<string, string> = {
  song: '10032020ondemand_track%3a%3atra.',
  album: '100420ec'
};

const parents: Record<string, string> = {
  song: '100420ecexplore%3a',
  album: '100420ecexplore%3aalbum%3a'
};

async function aldilifeMusic(player: PlayerLike, values: string[]): Promise<unknown> {
  const action = values[0];
  const track = values[1];

  if (!action || !track) {
    throw new Error('Expected action and track');
  }

  const [type, trackId] = track.split(':');
  const objectClass = classes[type];
  const metadataStarter = metadataUriStarters[type];
  const parent = parents[type];
  const uri = getUri(encodeURIComponent(trackId || ''), type);

  if (!trackId || !objectClass || !metadataStarter || !parent || !uri) {
    throw new Error(`Unsupported track type: ${type}`);
  }

  const encodedTrackId = encodeURIComponent(trackId);
  const metadataId = metadataStarter + encodedTrackId;
  const metadata = getMetadata(metadataId, parent, objectClass, '');
  const nextTrackNo = player.coordinator.state.trackNo + 1;

  if (action === 'queue') {
    return player.coordinator.addURIToQueue(uri, metadata);
  }

  if (action === 'now') {
    if (!player.coordinator.avTransportUri.startsWith('x-rincon-queue')) {
      await player.coordinator.setAVTransport(`x-rincon-queue:${player.coordinator.uuid}#0`);
    }
    const queueStatus = await player.coordinator.addURIToQueue(uri, metadata, true, nextTrackNo);
    await player.coordinator.trackSeek(queueStatus.firsttracknumberenqueued);
    await player.coordinator.play();
    return undefined;
  }

  if (action === 'next') {
    return player.coordinator.addURIToQueue(uri, metadata, true, nextTrackNo);
  }

  throw new Error('Aldi Life Music only handles the {queue, now, next} actions');
}

export = function (api: ActionApi): void {
  api.registerAction('aldilifemusic', aldilifeMusic);
};
