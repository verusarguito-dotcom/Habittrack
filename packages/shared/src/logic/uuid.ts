/**
 * RFC 4122 Compliant UUID v5 implementation with pure TypeScript SHA-1.
 * Zero external dependencies, 100% synchronous, works across browser and Node.js.
 */

export const VIBEHABIT_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // RFC 4122 DNS namespace

function sha1(message: Uint8Array): Uint8Array {
  const msgLen = message.length;
  // Padding calculation: msgLen + 1 (0x80) + padding zeros + 8 (length in bits)
  const paddedLen = Math.ceil((msgLen + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(message);
  padded[msgLen] = 0x80;

  // Append 64-bit length in bits (big-endian)
  const bitLen = BigInt(msgLen) * 8n;
  const view = new DataView(padded.buffer);
  view.setBigUint64(paddedLen - 8, bitLen, false);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Uint32Array(80);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }

    for (let t = 16; t < 80; t++) {
      const val = (w[t - 3]! ^ w[t - 8]! ^ w[t - 14]! ^ w[t - 16]!) >>> 0;
      w[t] = ((val << 1) | (val >>> 31)) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let t = 0; t < 80; t++) {
      let f = 0;
      let k = 0;

      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const rotA = ((a << 5) | (a >>> 27)) >>> 0;
      const temp = (rotA + f + e + k + w[t]!) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const result = new Uint8Array(20);
  const resView = new DataView(result.buffer);
  resView.setUint32(0, h0, false);
  resView.setUint32(4, h1, false);
  resView.setUint32(8, h2, false);
  resView.setUint32(12, h3, false);
  resView.setUint32(16, h4, false);

  return result;
}

function parseUuid(uuid: string): Uint8Array {
  const clean = uuid.replace(/-/g, '');
  if (clean.length !== 32 || !/^[0-9a-fA-F]{32}$/.test(clean)) {
    throw new Error(`Invalid UUID format: "${uuid}"`);
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function formatUuid(bytes: Uint8Array): string {
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i]!.toString(16).padStart(2, '0'));
  }
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join('')
  ].join('-');
}

/**
 * Generate a UUID v5 according to RFC 4122.
 */
export function uuidv5(name: string, namespace: string = VIBEHABIT_NAMESPACE): string {
  const nsBytes = parseUuid(namespace);
  const nameBytes = new TextEncoder().encode(name);

  const combined = new Uint8Array(nsBytes.length + nameBytes.length);
  combined.set(nsBytes, 0);
  combined.set(nameBytes, nsBytes.length);

  const digest = sha1(combined);
  const bytes = digest.slice(0, 16);

  // Set version to 5 (0101 in upper 4 bits of byte 6)
  bytes[6] = ((bytes[6]! & 0x0f) | 0x50) >>> 0;
  // Set variant to RFC 4122 (10xx in upper 2 bits of byte 8)
  bytes[8] = ((bytes[8]! & 0x3f) | 0x80) >>> 0;

  return formatUuid(bytes);
}

/**
 * Deterministic log ID generation for VibeHabit.
 * Generates identical UUID for the same habit_id and date.
 */
export function generateLogId(
  habitId: string,
  date: string,
  namespace: string = VIBEHABIT_NAMESPACE
): string {
  return uuidv5(`${habitId}:${date}`, namespace);
}
