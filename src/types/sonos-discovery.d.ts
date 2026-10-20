declare module 'sonos-discovery/lib/helpers/request' {
  interface RequestOptions {
    uri: string;
    method?: string;
    headers?: Record<string, string | number>;
    body?: string | Buffer;
    type?: string;
    timeout?: number;
  }
  function request<T = unknown>(options: RequestOptions): Promise<T>;
  export = request;
}

declare module 'sonos-discovery/lib/helpers/soap' {
  function invoke(url: string, action: string, values?: Record<string, unknown>): Promise<unknown>;
  function parse(stream: unknown): Promise<unknown>;
  const TYPE: Record<string, string>;
  export { invoke, parse, TYPE };
}

declare module 'sonos-discovery/lib/helpers/logger' {
  interface Logger {
    trace(...args: unknown[]): void;
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
  }
  const logger: Logger;
  export = logger;
}

declare module 'sonos-discovery/lib/helpers/require-dir' {
  function requireDir<T>(directory: string, register: (module: T) => void): void;
  export = requireDir;
}

declare module 'sonos-discovery/lib/prototypes/Player/getUriType' {
  function getUriType(uri: string): string;
  export = getUriType;
}

declare module 'sonos-discovery' {
  const SonosSystem: new (settings?: unknown) => unknown;
  export = SonosSystem;
}

declare module 'html-entities' {
  export class XmlEntities {
    decode(value: string): string;
    encode(value: string): string;
    encodeNonUTF(value: string): string;
  }
}
