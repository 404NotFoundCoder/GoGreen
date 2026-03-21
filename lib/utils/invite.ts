import { INVITE_CODE_LENGTH } from "@/constants/config";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(
  length: number = INVITE_CODE_LENGTH,
): string {
  let s = "";
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint8Array(length);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < length; i++) {
      s += ALPHABET[buf[i]! % ALPHABET.length];
    }
    return s;
  }
  for (let i = 0; i < length; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]!;
  }
  return s;
}
