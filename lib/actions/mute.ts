import type { ActionApi, PlayerLike } from '../../src/types/actions';

function mute(player: PlayerLike): Promise<unknown> {
  return player.mute();
}

function groupMute(player: PlayerLike): Promise<unknown> {
  return player.coordinator.muteGroup();
}

function unmute(player: PlayerLike): Promise<unknown> {
  return player.unMute();
}

function groupUnmute(player: PlayerLike): Promise<unknown> {
  return player.coordinator.unMuteGroup();
}

function toggleMute(player: PlayerLike): Promise<unknown> {
  const ret: { status: string; muted: boolean } = { status: 'success', muted: true };
  if (player.state.mute) {
    ret.muted = false;
    return player.unMute().then(() => ret);
  }
  return player.mute().then(() => ret);
}

export = function (api: ActionApi): void {
  api.registerAction('mute', mute);
  api.registerAction('unmute', unmute);
  api.registerAction('groupmute', groupMute);
  api.registerAction('groupunmute', groupUnmute);
  api.registerAction('mutegroup', groupMute);
  api.registerAction('unmutegroup', groupUnmute);
  api.registerAction('togglemute', toggleMute);
};
