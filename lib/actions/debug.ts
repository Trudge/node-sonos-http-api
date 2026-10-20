import type { ActionApi, PlayerLike } from '../../src/types/actions';

import pkg = require('../../package.json');

function debug(player: PlayerLike): Promise<unknown> {
  const system = player.system;
  return Promise.resolve({
    version: pkg.version,
    system: {
      localEndpoint: system.localEndpoint,
      availableServices: system.availableServices
    },
    players: system.players.map((member: PlayerLike) => ({
      roomName: member.roomName,
      uuid: member.uuid,
      coordinator: member.coordinator.uuid,
      avTransportUri: member.avTransportUri,
      avTransportUriMetadata: member.avTransportUriMetadata,
      enqueuedTransportUri: member.enqueuedTransportUri,
      enqueuedTransportUriMetadata: member.enqueuedTransportUriMetadata,
      baseUrl: member.baseUrl,
      state: member._state
    }))
  });
}

export = function (api: ActionApi): void {
  api.registerAction('debug', debug);
};
