import type { ActionApi, PlayerLike } from '../../src/types/actions';
import logger = require('sonos-discovery/lib/helpers/logger');

function addToGroup(player: PlayerLike, values: string[]): Promise<unknown> {
  const joiningRoomName = decodeURIComponent(values[0]);
  const joiningPlayer = player.system.getPlayer(joiningRoomName);
  if (!joiningPlayer) {
    logger.warn(`Room ${joiningRoomName} not found - can't group with ${player.roomName}`);
    return Promise.reject(new Error(`Room ${joiningRoomName} not found - can't group with ${player.roomName}`));
  }
  return attachTo(joiningPlayer, player.coordinator);
}

function joinPlayer(player: PlayerLike, values: string[]): Promise<unknown> {
  const receivingRoomName = decodeURIComponent(values[0]);
  const receivingPlayer = player.system.getPlayer(receivingRoomName);
  if (!receivingPlayer) {
    logger.warn(`Room ${receivingRoomName} not found - can't make ${player.roomName} join it`);
    return Promise.reject(new Error(`Room ${receivingRoomName} not found - can't make ${player.roomName} join it`));
  }
  return attachTo(player, receivingPlayer.coordinator);
}

function rinconUri(player: PlayerLike): string {
  return `x-rincon:${player.uuid}`;
}

function attachTo(player: PlayerLike, coordinator: PlayerLike): Promise<unknown> {
  return player.setAVTransport(rinconUri(coordinator));
}

function isolate(player: PlayerLike): Promise<unknown> {
  return player.becomeCoordinatorOfStandaloneGroup();
}

export = function (api: ActionApi): void {
  api.registerAction('add', addToGroup);
  api.registerAction('isolate', isolate);
  api.registerAction('ungroup', isolate);
  api.registerAction('leave', isolate);
  api.registerAction('join', joinPlayer);
};
