import Fuse from 'fuse.js';
import channels = require('../sirius-channels.json');
import type { ActionApi, MediaItem, PlayerLike } from '../../src/types/actions';

interface SiriusChannel {
  fullTitle: string;
  channelNum: string;
  title: string;
  id: string;
  parentID: string;
}

const channelList = channels as SiriusChannel[];

function getSiriusXmMetadata(id: string, parent: string, title: string): string {
  return `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"
        xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
        <item id="00092120r%3a${id}" parentID="${parent}" restricted="true"><dc:title>${title}</dc:title><upnp:class>object.item.audioItem.audioBroadcast</upnp:class>
        <desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">_</desc></item></DIDL-Lite>`;
}

function getSiriusXmUri(id: string): string {
  return `x-sonosapi-hls:r%3a${id}?sid=37&flags=8480&sn=11`;
}

const replacements = [
  'ñ|n', 'á|a', 'ó|o', 'è|e', 'ë|e', '/| ', '-| ', 'siriusxm|sirius XM',
  'sxm|SXM', 'cnn|CNN', 'hln|HLN', 'msnbc|MSNBC', 'bbc|BBC', 'ici|ICI',
  'prx|PRX', 'cbc|CBC', 'npr|NPR', 'espn|ESPN', ' ny| NY', 'kiis|KIIS',
  '&|and', 'ami|AMI', 'z1|Z1', '2k|2K', 'bb |BB '
];

function adjustStation(name: string): string {
  let adjusted = name.toLowerCase();
  replacements.forEach((replacement) => {
    const [from, to] = replacement.split('|');
    adjusted = adjusted.replace(from, to);
  });
  return adjusted;
}

async function siriusXM(player: PlayerLike, values: string[]): Promise<unknown> {
  const action = values[0];

  if (action === 'data') {
    const favorites = await player.system.getFavorites();
    return favorites.reduce((promise: Promise<string>, item: MediaItem) => promise.then(() => {
      const uri = String(item.uri || '');
      if (uri.startsWith('x-sonosapi-hls:')) {
        const title = String(item.title || '').replace("'", '');
        const metadata = String(item.metadata || '');
        console.log(`{fullTitle:'${title}', channelNum:'${title.substring(0, title.search(' - '))}', title:'${title.substring(title.search(' - ') + 3, title.length)}', id:'${uri.substring(uri.search('r%3a') + 4, uri.search('sid=') - 1)}', parentID:'${metadata.substring(metadata.search('parentID=') + 10, metadata.search(' restricted') - 1)}'},`);
      }
      return 'success';
    }), Promise.resolve('success'));
  }

  if (action === 'channels') {
    channelList
      .map((channel) => channel.channelNum)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((channel) => { console.log(channel); });
    return 'success';
  }

  if (action === 'stations') {
    channelList.forEach((channel) => { console.log(adjustStation(channel.title)); });
    return 'success';
  }

  if (!action) {
    throw new Error('Expected a SiriusXM channel or station');
  }

  const fuzzy = new Fuse(channelList, { keys: ['channelNum', 'title'] });
  const results = fuzzy.search(action);
  if (results.length === 0) {
    throw new Error(`No SiriusXM channel found for ${action}`);
  }

  const channel = results[0].item;
  const uri = getSiriusXmUri(channel.id);
  const metadata = getSiriusXmMetadata(channel.id, channel.parentID, channel.fullTitle);

  await player.coordinator.setAVTransport(uri, metadata);
  await player.coordinator.play();
  return undefined;
}

export = function (api: ActionApi): void {
  api.registerAction('siriusxm', siriusXM);
};
