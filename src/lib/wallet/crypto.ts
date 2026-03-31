/**
 * Wallet encryption for private key storage in localStorage.
 *
 * Uses Web Crypto API (AES-GCM + PBKDF2) when available (HTTPS).
 * Falls back to XOR-based obfuscation on plain HTTP (demo only).
 */

const STORAGE_KEY = 'mantis-wallet';
const PBKDF2_ITERATIONS = 100_000;

interface StoredWallet {
  v: number;     // version: 1 = AES-GCM, 2 = fallback
  salt: string;
  iv: string;
  ct: string;
  addr: string;
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function hasSubtleCrypto(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

function hexEncode(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexDecode(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// ═══════════════════════════════════════════════
// AES-GCM (secure context — HTTPS / localhost)
// ═══════════════════════════════════════════════

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password).buffer as ArrayBuffer, 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function aesEncrypt(plaintext: string, password: string): Promise<{ salt: string; iv: string; ct: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    enc.encode(plaintext).buffer as ArrayBuffer,
  );
  return { salt: hexEncode(salt), iv: hexEncode(iv), ct: hexEncode(ciphertext) };
}

async function aesDecrypt(salt: string, iv: string, ct: string, password: string): Promise<string> {
  const saltBuf = hexDecode(salt);
  const ivBuf = hexDecode(iv);
  const ctBuf = hexDecode(ct);
  const key = await deriveKey(password, saltBuf);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuf.buffer as ArrayBuffer },
    key,
    ctBuf.buffer as ArrayBuffer,
  );
  return new TextDecoder().decode(plaintext);
}

// ═══════════════════════════════════════════════
// FALLBACK (HTTP — demo/hackathon only)
// XOR with password-derived key. NOT cryptographically secure.
// ═══════════════════════════════════════════════

function fallbackEncrypt(plaintext: string, password: string): { salt: string; iv: string; ct: string } {
  // Derive a longer key by hashing password repeatedly
  let keyStream = '';
  let seed = password;
  for (let i = 0; i < Math.ceil(plaintext.length / password.length) + 2; i++) {
    let hash = 0;
    for (let j = 0; j < seed.length; j++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(j)) | 0;
    }
    seed = password + hash.toString(36) + i;
    keyStream += seed;
  }

  let result = '';
  for (let i = 0; i < plaintext.length; i++) {
    result += String.fromCharCode(plaintext.charCodeAt(i) ^ keyStream.charCodeAt(i % keyStream.length));
  }
  return { salt: 'http', iv: 'fallback', ct: btoa(result) };
}

function fallbackDecrypt(ct: string, password: string): string {
  const encoded = atob(ct);
  let keyStream = '';
  let seed = password;
  for (let i = 0; i < Math.ceil(encoded.length / password.length) + 2; i++) {
    let hash = 0;
    for (let j = 0; j < seed.length; j++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(j)) | 0;
    }
    seed = password + hash.toString(36) + i;
    keyStream += seed;
  }

  let result = '';
  for (let i = 0; i < encoded.length; i++) {
    result += String.fromCharCode(encoded.charCodeAt(i) ^ keyStream.charCodeAt(i % keyStream.length));
  }
  return result;
}

// ═══════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════

/** Encrypt a private key and store in localStorage */
export async function encryptAndStore(privateKey: string, password: string, address: string): Promise<void> {
  if (!isBrowser()) throw new Error('Not in browser');

  let encrypted: { salt: string; iv: string; ct: string };
  let version: number;

  if (hasSubtleCrypto()) {
    encrypted = await aesEncrypt(privateKey, password);
    version = 1;
  } else {
    encrypted = fallbackEncrypt(privateKey, password);
    version = 2;
  }

  const wallet: StoredWallet = { v: version, ...encrypted, addr: address };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
}

/** Decrypt private key from localStorage */
export async function decryptFromStorage(password: string): Promise<string> {
  if (!isBrowser()) throw new Error('Not in browser');

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error('No wallet found');

  const wallet: StoredWallet = JSON.parse(raw);

  try {
    if (wallet.v === 1 && hasSubtleCrypto()) {
      return await aesDecrypt(wallet.salt, wallet.iv, wallet.ct, password);
    } else if (wallet.v === 2 || !hasSubtleCrypto()) {
      const result = fallbackDecrypt(wallet.ct, password);
      // Validate: decrypted PK should start with 0x and be 66 chars
      if (!result.startsWith('0x') || result.length !== 66) {
        throw new Error('Wrong password');
      }
      return result;
    } else {
      throw new Error('Incompatible wallet version');
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'Wrong password') throw e;
    if (e instanceof Error && e.message === 'Incompatible wallet version') throw e;
    throw new Error('Wrong password');
  }
}

/** Check if an encrypted wallet exists in localStorage */
export function hasStoredWallet(): boolean {
  if (!isBrowser()) return false;
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/** Get the stored wallet address (visible even when locked) */
export function getStoredAddress(): string | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const wallet: StoredWallet = JSON.parse(raw);
    return wallet.addr;
  } catch {
    return null;
  }
}

/** Remove wallet from localStorage */
export function removeStoredWallet(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
}

/** Check if running in secure context (HTTPS) */
export function isSecureContext(): boolean {
  if (!isBrowser()) return false;
  return hasSubtleCrypto();
}
