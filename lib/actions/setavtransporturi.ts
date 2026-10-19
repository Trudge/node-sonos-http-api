import type { ActionApi, PlayerLike } from '../../src/types/actions';

function setAVTransportURI(player: PlayerLike, values: string[]): Promise<unknown> {
  return player.setAVTransport(decodeURIComponent(values[0]));
}

export = function (api: ActionApi): void {
  api.registerAction('setavtransporturi', setAVTransportURI);
};
