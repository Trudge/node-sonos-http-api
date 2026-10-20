import type { ActionApi, PlayerLike } from '../../src/types/actions';

function getTuneInMetadata(uri: string, serviceType: string | number): string {
  return `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"
        xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
        <item id="F00092020s${uri}" parentID="L" restricted="true"><dc:title>tunein</dc:title><upnp:class>object.item.audioItem.audioBroadcast</upnp:class>
        <desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON${serviceType}_</desc></item></DIDL-Lite>`;
}

async function tuneIn(player: PlayerLike, values: string[]): Promise<unknown> {
  const action = values[0];
  const tuneInUri = values[1];

  if (!tuneInUri) {
    throw new Error('Expected TuneIn station id');
  }

  const encodedTuneInUri = encodeURIComponent(tuneInUri);
  const sid = player.system.getServiceId('TuneIn');
  const metadata = getTuneInMetadata(encodedTuneInUri, player.system.getServiceType('TuneIn'));
  const uri = `x-sonosapi-stream:s${encodedTuneInUri}?sid=${sid}&flags=8224&sn=0`;

  if (action === 'play') {
    await player.coordinator.setAVTransport(uri, metadata);
    await player.coordinator.play();
    return undefined;
  }
  if (action === 'set') {
    return player.coordinator.setAVTransport(uri, metadata);
  }

  throw new Error('TuneIn only handles the {play} & {set} action');
}

export = function (api: ActionApi): void {
  api.registerAction('tunein', tuneIn);
};
