declare module 'linkedom' {
  export class DOMParser {
    parseFromString(input: string, type: string): Document;
  }
}

declare module '@supabase/supabase-js' {
  export function createClient(url: string, key: string, options?: any): any;
}

declare module 'vitest' {
  export const describe: any;
  export const expect: any;
  export const it: any;
}
