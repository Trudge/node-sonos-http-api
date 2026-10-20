declare module 'basic-auth' {
  function auth(req: unknown): { name: string; pass: string } | undefined;
  export = auth;
}

declare module 'serve-static' {
  function serve(root: string, options?: unknown): (req: unknown, res: unknown, next: (err?: unknown) => void) => void;
  export = serve;
}
