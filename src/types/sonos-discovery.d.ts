declare module 'sonos-discovery/lib/helpers/request' {
  interface RequestOptions {
    uri: string;
    method?: string;
    headers?: Record<string, string | number>;
    body?: string | Buffer;
    type?: string;
    timeout?: number;
  }
  function request(options: RequestOptions): Promise<any>;
  export = request;
}

declare module 'sonos-discovery/lib/helpers/soap' {
  function invoke(url: string, action: string, values?: Record<string, unknown>): Promise<any>;
  function parse(stream: any): Promise<any>;
  const TYPE: Record<string, string>;
  export { invoke, parse, TYPE };
}

declare module 'sonos-discovery/lib/prototypes/Player/getUriType' {
  function getUriType(uri: string): string;
  export = getUriType;
}

declare module 'sonos-discovery' {
  const SonosSystem: any;
  export = SonosSystem;
}

declare module 'html-entities' {
  export class XmlEntities {
    decode(value: string): string;
    encode(value: string): string;
  }
}
