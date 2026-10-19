declare module 'basic-auth' {
  function auth(req: any): { name: string; pass: string } | undefined;
  export = auth;
}

declare module 'serve-static' {
  function serve(root: string, options?: any): (req: any, res: any, next: (err?: any) => void) => void;
  export = serve;
}
