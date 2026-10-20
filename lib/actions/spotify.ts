import type { ActionApi, PlayerLike } from '../../src/types/actions';

function getSpotifyMetadata(uri: string, serviceType: string | number): string {
  return `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"
        xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
        <item id="00030020${uri}" restricted="true"><upnp:class>object.item.audioItem.musicTrack</upnp:class>
        <desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON${serviceType}_X_#Svc${serviceType}-0-Token</desc></item></DIDL-Lite>`;
}

async function spotify(player: PlayerLike, values: string[]): Promise<unknown> {
  const action = values[0];
  const spotifyUri = values[1];

  if (!action || !spotifyUri) {
    throw new Error('Expected action and Spotify URI');
  }

  const encodedSpotifyUri = encodeURIComponent(spotifyUri);
  const sid = player.system.getServiceId('Spotify');
  const uri = spotifyUri.startsWith('spotify:track:')
    ? `x-sonos-spotify:${encodedSpotifyUri}?sid=${sid}&flags=32&sn=1`
    : `x-rincon-cpcontainer:0006206c${encodedSpotifyUri}`;
  const metadata = getSpotifyMetadata(encodedSpotifyUri, player.system.getServiceType('Spotify'));
  const nextTrackNo = player.coordinator.state.trackNo + 1;

  if (action === 'queue') {
    return player.coordinator.addURIToQueue(uri, metadata);
  }

  if (action === 'now') {
    await player.coordinator.setAVTransport(`x-rincon-queue:${player.coordinator.uuid}#0`);
    const queueStatus = await player.coordinator.addURIToQueue(uri, metadata, true, nextTrackNo);
    await player.coordinator.trackSeek(queueStatus.firsttracknumberenqueued);
    await player.coordinator.play();
    return undefined;
  }

  if (action === 'next') {
    return player.coordinator.addURIToQueue(uri, metadata, true, nextTrackNo);
  }

  throw new Error('Spotify only handles the {queue, now, next} actions');
}

export = function (api: ActionApi): void {
  api.registerAction('spotify', spotify);
};
