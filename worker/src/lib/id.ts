export const newId = () => crypto.randomUUID();

export const now = () => Math.floor(Date.now() / 1000);

export function bytesToHex(bytes: Uint8Array | ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function randomHex(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}
