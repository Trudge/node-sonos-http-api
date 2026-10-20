import type { ActionApi, PlayerLike } from '../../src/types/actions';

function getMetadata(station: string): string {
  return `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
        <item id="83207${station}" parentID="L" restricted="true"><dc:title>BBC Sounds</dc:title><upnp:class>object.item.audioItem.audioBroadcast</upnp:class>
        <desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON83207_</desc></item></DIDL-Lite>`;
}

function getUri(station: string): string {
  return `x-sonosapi-hls:stations%7eplayable%7e%7e${station}%7e%7eurn%3abbc%3aradio%3anetwork%3a${station}?sid=325&flags=288&sn=10`;
}

async function bbcSounds(player: PlayerLike, values: string[]): Promise<unknown> {
  const action = values[0];
  const station = encodeURIComponent(values[1] || '');

  if (!station) {
    throw new Error('Expected BBC Sounds station name.');
  }

  const metadata = getMetadata(station);
  const uri = getUri(station);

  if (action === 'play') {
    await player.coordinator.setAVTransport(uri, metadata);
    await player.coordinator.play();
    return undefined;
  }
  if (action === 'set') {
    return player.coordinator.setAVTransport(uri, metadata);
  }

  throw new Error('BBC Sounds only handles the {play} & {set} actions.');
}

export = function (api: ActionApi): void {
  api.registerAction('bbcsounds', bbcSounds);
};
