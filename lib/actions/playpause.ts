import type { ActionApi, PlayerLike } from '../../src/types/actions';

function playpause(player: PlayerLike): Promise<unknown> {
  const ret: any = { status: 'success', paused: false };
  if (player.coordinator.state.playbackState === 'PLAYING') {
    ret.paused = true;
    return player.coordinator.pause().then(() => ret);
  }
  return player.coordinator.play().then(() => ret);
}

function play(player: PlayerLike): Promise<unknown> {
  return player.coordinator.play();
}

function pause(player: PlayerLike): Promise<unknown> {
  return player.coordinator.pause();
}

export = function (api: ActionApi): void {
  api.registerAction('playpause', playpause);
  api.registerAction('play', play);
  api.registerAction('pause', pause);
};
