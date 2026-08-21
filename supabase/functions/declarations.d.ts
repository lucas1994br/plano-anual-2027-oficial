// Declarações de tipo para Deno e imports de URL em Supabase Edge Functions
declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): { [key: string]: string };
  }

  export const env: Env;

  export namespace errors {
    export class NotFound extends Error {}
    export class PermissionDenied extends Error {}
  }
}

declare module "https://*" {
  const all: any;
  export default all;
  export const serve: any;
  export const createClient: any;
  export const crypto: any;
}
