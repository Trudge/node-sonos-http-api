import type { ActionApi, PlayerLike } from '../../src/types/actions';

function linein(player: PlayerLike, values: string[]): Promise<unknown> {
  const sourcePlayerName = values[0];
  let lineinSourcePlayer: PlayerLike | undefined = player;
  if (sourcePlayerName) {
    lineinSourcePlayer = player.system.getPlayer(decodeURIComponent(sourcePlayerName));
  }
  if (!lineinSourcePlayer) {
    return Promise.reject(new Error(`Could not find player ${sourcePlayerName}`));
  }
  const uri = `x-rincon-stream:${lineinSourcePlayer.uuid}`;
  return player.coordinator.setAVTransport(uri).then(() => player.coordinator.play());
}

export = function (api: ActionApi): void {
  api.registerAction('linein', linein);
};
