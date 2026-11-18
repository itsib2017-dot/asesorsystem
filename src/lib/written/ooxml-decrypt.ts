import crypto from "node:crypto";
import { isOleEncryptedBuffer } from "@/services/extract";

const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;
const FATSECT = 0xfffffffd;
const DIFSECT = 0xfffffffc;

const AGILE_VERIFIER_HASH_INPUT_BLOCK_KEY = Buffer.from([
  0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79,
]);
const AGILE_VERIFIER_HASH_VALUE_BLOCK_KEY = Buffer.from([
  0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e,
]);
const AGILE_ENCRYPTED_KEY_BLOCK_KEY = Buffer.from([
  0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6,
]);

function readCfbStream(cfb: Buffer, streamName: string): Buffer | null {
  if (!isOleEncryptedBuffer(cfb) || cfb.length < 512) return null;

  const sectorShift = cfb.readUInt16LE(30);
  const miniSectorShift = cfb.readUInt16LE(32);
  const sectorSize = 1 << sectorShift;
  const miniSectorSize = 1 << miniSectorShift;
  if (sectorSize < 512 || miniSectorSize < 32) return null;

  const firstDirSector = cfb.readUInt32LE(48);
  const miniCutoff = cfb.readUInt32LE(56);
  const firstMiniFatSector = cfb.readUInt32LE(60);
  const firstDifatSector = cfb.readUInt32LE(68);
  const totalDifatSectors = cfb.readUInt32LE(72);

  const sectorOffset = (sect: number) => (sect + 1) * sectorSize;
  const readSector = (sect: number): Buffer => {
    const start = sectorOffset(sect);
    return cfb.subarray(start, Math.min(cfb.length, start + sectorSize));
  };

  // Collect FAT sector IDs from header DIFAT (first 109) + DIFAT chain
  const fatSectors: number[] = [];
  for (let i = 0; i < 109; i++) {
    const s = cfb.readUInt32LE(76 + i * 4);
    if (s !== FREESECT && s !== ENDOFCHAIN && s !== FATSECT && s !== DIFSECT) {
      fatSectors.push(s);
    }
  }

  let difatSect = firstDifatSector;
  let difatGuard = 0;
  while (
    difatSect !== ENDOFCHAIN &&
    difatSect !== FREESECT &&
    difatGuard < Math.max(totalDifatSectors + 2, 16)
  ) {
    const buf = readSector(difatSect);
    const entriesPerSect = Math.floor(sectorSize / 4) - 1;
    for (let i = 0; i < entriesPerSect; i++) {
      const s = buf.readUInt32LE(i * 4);
      if (s !== FREESECT && s !== ENDOFCHAIN && s !== FATSECT && s !== DIFSECT) {
        fatSectors.push(s);
      }
    }
    difatSect = buf.readUInt32LE(entriesPerSect * 4);
    difatGuard++;
  }

  // Build FAT array
  const fat: number[] = [];
  for (const fs of fatSectors) {
    const sec = readSector(fs);
    for (let off = 0; off + 4 <= sec.length; off += 4) {
      fat.push(sec.readUInt32LE(off));
    }
  }

  const readFatChain = (startSect: number, maxLen?: number): Buffer => {
    const chunks: Buffer[] = [];
    const seen = new Set<number>();
    let cur = startSect;
    let total = 0;
    while (cur !== ENDOFCHAIN && cur !== FREESECT && !seen.has(cur)) {
      seen.add(cur);
      const sec = readSector(cur);
      chunks.push(sec);
      total += sec.length;
      if (maxLen !== undefined && total >= maxLen) break;
      cur = fat[cur] ?? ENDOFCHAIN;
    }
    const full = Buffer.concat(chunks);
    return maxLen !== undefined ? full.subarray(0, maxLen) : full;
  };

  // Directory stream
  const dirBuf = readFatChain(firstDirSector);
  interface DirEntry {
    name: string;
    objType: number;
    startSect: number;
    size: number;
  }
  const entries: DirEntry[] = [];
  for (let off = 0; off + 128 <= dirBuf.length; off += 128) {
    const nameLen = dirBuf.readUInt16LE(off + 64);
    const objType = dirBuf.readUInt8(off + 66);
    if (objType === 0 || nameLen < 2 || nameLen > 64) continue;
    const name = dirBuf.subarray(off, off + nameLen - 2).toString("utf16le");
    const startSect = dirBuf.readUInt32LE(off + 116);
    const size = dirBuf.readUInt32LE(off + 120);
    entries.push({ name, objType, startSect, size });
  }

  const target = entries.find(
    (e) => e.objType === 2 && e.name.toLowerCase() === streamName.toLowerCase(),
  );
  if (!target) return null;

  if (target.size >= miniCutoff) {
    return readFatChain(target.startSect, target.size);
  }

  // Mini-stream lives in Root Entry (entries[0])
  const root = entries.find((e) => e.objType === 5);
  if (!root || firstMiniFatSector === ENDOFCHAIN || firstMiniFatSector === FREESECT) {
    return readFatChain(target.startSect, target.size);
  }

  const miniStream = readFatChain(root.startSect, root.size);
  const miniFatBuf = readFatChain(firstMiniFatSector);
  const miniFat: number[] = [];
  for (let off = 0; off + 4 <= miniFatBuf.length; off += 4) {
    miniFat.push(miniFatBuf.readUInt32LE(off));
  }

  const chunks: Buffer[] = [];
  const seenMini = new Set<number>();
  let curMini = target.startSect;
  let remaining = target.size;
  while (curMini !== ENDOFCHAIN && curMini !== FREESECT && remaining > 0 && !seenMini.has(curMini)) {
    seenMini.add(curMini);
    const start = curMini * miniSectorSize;
    const end = Math.min(miniStream.length, start + Math.min(miniSectorSize, remaining));
    chunks.push(miniStream.subarray(start, end));
    remaining -= end - start;
    curMini = miniFat[curMini] ?? ENDOFCHAIN;
  }
  return Buffer.concat(chunks);
}

function mapHashAlgorithm(name: string): string {
  const n = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (n === "SHA512") return "sha512";
  if (n === "SHA384") return "sha384";
  if (n === "SHA256") return "sha256";
  if (n === "SHA1") return "sha1";
  throw new Error(`UNSUPPORTED_ENCRYPTION: Algoritma hash '${name}' tidak didukung.`);
}

function parseXmlTagAttrs(xml: string, tagName: string): Record<string, string> | null {
  const re = new RegExp(`<${tagName}\\b([^>]*)>`, "i");
  const match = xml.match(re);
  if (!match?.[1]) return null;
  const attrs: Record<string, string> = {};
  for (const am of match[1].matchAll(/([a-zA-Z0-9:_-]+)\s*=\s*"([^"]*)"/g)) {
    if (am[1] && am[2] !== undefined) {
      attrs[am[1]] = am[2];
    }
  }
  return attrs;
}

function deriveAgileIntermediateHash(
  password: string,
  hashAlg: string,
  salt: Buffer,
  spinCount: number,
): Buffer {
  const pwBuf = Buffer.from(password, "utf16le");
  let h: Buffer = crypto
    .createHash(hashAlg)
    .update(Buffer.concat([salt, pwBuf]))
    .digest();

  const iterBuf = Buffer.allocUnsafe(4);
  for (let i = 0; i < spinCount; i++) {
    iterBuf.writeUInt32LE(i, 0);
    h = crypto.createHash(hashAlg).update(Buffer.concat([iterBuf, h])).digest();
  }
  return h;
}

function deriveKeyFromIntermediate(
  intermediate: Buffer,
  hashAlg: string,
  blockKey: Buffer,
  keySizeBytes: number,
): Buffer {
  const raw = crypto
    .createHash(hashAlg)
    .update(Buffer.concat([intermediate, blockKey]))
    .digest();
  if (raw.length >= keySizeBytes) {
    return raw.subarray(0, keySizeBytes);
  }
  const padded = Buffer.alloc(keySizeBytes, 0x36);
  raw.copy(padded, 0);
  return padded;
}

function aesCbcDecryptNoPad(key: Buffer, iv: Buffer, ciphertext: Buffer): Buffer {
  const bits = key.length * 8;
  if (bits !== 128 && bits !== 192 && bits !== 256) {
    throw new Error(`UNSUPPORTED_ENCRYPTION: Panjang kunci AES (${bits}-bit) tidak didukung.`);
  }
  const normalizedIv = iv.length >= 16 ? iv.subarray(0, 16) : Buffer.concat([iv, Buffer.alloc(16 - iv.length)]);
  const decipher = crypto.createDecipheriv(`aes-${bits}-cbc`, key, normalizedIv);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Decrypts a password-protected OOXML (.docx) file stored inside an OLE Compound File Binary
 * using MS-OFFCRYPTO Agile Encryption (Office 2010+). Password is used only in memory.
 */
export function decryptAgileOoxmlBuffer(buffer: Buffer, password: string): Buffer {
  if (!isOleEncryptedBuffer(buffer)) {
    return buffer;
  }

  if (!password) {
    throw new Error(
      "KEY_ENCRYPTED: Berkas 06B terenkripsi — masukkan kata sandi berkas pada kolom kata sandi runtime.",
    );
  }

  const encInfo = readCfbStream(buffer, "EncryptionInfo");
  const encPkg = readCfbStream(buffer, "EncryptedPackage");
  if (!encInfo || !encPkg || encInfo.length < 8 || encPkg.length < 8) {
    throw new Error(
      "UNSUPPORTED_ENCRYPTION: Struktur enkripsi berkas OLE tidak lengkap.",
    );
  }

  const verMajor = encInfo.readUInt16LE(0);
  const verMinor = encInfo.readUInt16LE(2);
  if (verMajor !== 4 || verMinor !== 4) {
    throw new Error(
      `UNSUPPORTED_ENCRYPTION: Hanya mendukung Office Agile Encryption (v4.4), terdeteksi v${verMajor}.${verMinor}.`,
    );
  }

  const xml = encInfo.subarray(8).toString("utf8");
  const keyData = parseXmlTagAttrs(xml, "keyData");
  const pwdKey = parseXmlTagAttrs(xml, "p:encryptedKey");
  if (!keyData || !pwdKey) {
    throw new Error("UNSUPPORTED_ENCRYPTION: Metadata kunci enkripsi XML tidak ditemukan.");
  }

  const pkgSalt = Buffer.from(keyData.saltValue ?? "", "base64");
  const pkgHashAlg = mapHashAlgorithm(keyData.hashAlgorithm ?? "SHA512");
  const pkgBlockSize = Number(keyData.blockSize ?? 16);

  const spinCount = Number(pwdKey.spinCount ?? 100000);
  if (!Number.isFinite(spinCount) || spinCount < 1 || spinCount > 2_000_000) {
    throw new Error("UNSUPPORTED_ENCRYPTION: spinCount enkripsi berada di luar batas aman.");
  }
  const keySalt = Buffer.from(pwdKey.saltValue ?? "", "base64");
  const keyHashAlg = mapHashAlgorithm(pwdKey.hashAlgorithm ?? "SHA512");
  const keyBytes = Math.floor(Number(pwdKey.keyBits ?? 256) / 8);

  const intermediate = deriveAgileIntermediateHash(password, keyHashAlg, keySalt, spinCount);

  const verifierInputKey = deriveKeyFromIntermediate(
    intermediate,
    keyHashAlg,
    AGILE_VERIFIER_HASH_INPUT_BLOCK_KEY,
    keyBytes,
  );
  const verifierValueKey = deriveKeyFromIntermediate(
    intermediate,
    keyHashAlg,
    AGILE_VERIFIER_HASH_VALUE_BLOCK_KEY,
    keyBytes,
  );
  const encKeyKey = deriveKeyFromIntermediate(
    intermediate,
    keyHashAlg,
    AGILE_ENCRYPTED_KEY_BLOCK_KEY,
    keyBytes,
  );

  const decVerifierInput = aesCbcDecryptNoPad(
    verifierInputKey,
    keySalt,
    Buffer.from(pwdKey.encryptedVerifierHashInput ?? "", "base64"),
  ).subarray(0, Number(pwdKey.saltSize ?? 16));

  const actualVerifierHash = crypto.createHash(keyHashAlg).update(decVerifierInput).digest();
  const expectedVerifierHash = aesCbcDecryptNoPad(
    verifierValueKey,
    keySalt,
    Buffer.from(pwdKey.encryptedVerifierHashValue ?? "", "base64"),
  ).subarray(0, actualVerifierHash.length);

  if (
    actualVerifierHash.length !== expectedVerifierHash.length ||
    !crypto.timingSafeEqual(actualVerifierHash, expectedVerifierHash)
  ) {
    throw new Error(
      "KEY_WRONG_PASSWORD: Kata sandi berkas 06B tidak cocok. Periksa kembali kata sandi Anda.",
    );
  }

  const packageKey = aesCbcDecryptNoPad(
    encKeyKey,
    keySalt,
    Buffer.from(pwdKey.encryptedKeyValue ?? "", "base64"),
  ).subarray(0, Math.floor(Number(keyData.keyBits ?? 256) / 8));

  const unencryptedSize = Number(encPkg.readBigUInt64LE(0));
  const payload = encPkg.subarray(8);
  const segSize = 4096;
  const decryptedChunks: Buffer[] = [];
  const segIdxBuf = Buffer.allocUnsafe(4);

  for (let seg = 0; seg * segSize < payload.length; seg++) {
    const chunk = payload.subarray(seg * segSize, Math.min(payload.length, (seg + 1) * segSize));
    segIdxBuf.writeUInt32LE(seg, 0);
    const ivRaw = crypto
      .createHash(pkgHashAlg)
      .update(Buffer.concat([pkgSalt, segIdxBuf]))
      .digest();
    const iv =
      ivRaw.length >= pkgBlockSize
        ? ivRaw.subarray(0, pkgBlockSize)
        : Buffer.concat([ivRaw, Buffer.alloc(pkgBlockSize - ivRaw.length)]);
    decryptedChunks.push(aesCbcDecryptNoPad(packageKey, iv, chunk));
  }

  return Buffer.concat(decryptedChunks).subarray(0, unencryptedSize);
}
