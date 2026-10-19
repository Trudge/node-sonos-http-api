export interface PlayerState {
  [key: string]: any;
}

export interface PlayerLike {
  [key: string]: any;
  uuid: string;
  roomName: string;
  state: PlayerState;
  coordinator: PlayerLike;
  system: SonosSystemLike;
}

export interface SonosSystemLike {
  [key: string]: any;
  zones: any[];
  players: PlayerLike[];
}

export type ActionHandler = (
  player: PlayerLike,
  values: string[]
) => Promise<unknown> | unknown;

export interface ActionApi {
  registerAction(name: string, handler: ActionHandler): void;
  getPort(): number;
  getWebRoot(): string;
  discovery: SonosSystemLike;
}
