export function crc32(buf: Buffer | Uint8Array | string): number;
export function zipStore(files: { name: string; data: Buffer | Uint8Array | string }[]): Buffer;
