declare module 'node:crypto' {
  export interface Hash {
    update(data: string | Uint8Array): this;
    digest(encoding: 'hex' | 'base64' | string): string;
  }
  export function createHash(algorithm: string): Hash;
  export function timingSafeEqual(a: NodeJS.ArrayBufferView | ArrayBufferView, b: NodeJS.ArrayBufferView | ArrayBufferView): boolean;
}
