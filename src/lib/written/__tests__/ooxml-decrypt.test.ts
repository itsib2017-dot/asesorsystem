import crypto from "node:crypto";
import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import { decryptAgileOoxmlBuffer } from "../ooxml-decrypt";
import { parseMasterKey06bFile } from "../master-key";
import { extractTextFromDocx } from "@/services/extract";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;
const FATSECT = 0xfffffffd;

const BLOCK_VERIFIER_INPUT = Buffer.from([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]);
const BLOCK_VERIFIER_VALUE = Buffer.from([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]);
const BLOCK_ENCRYPTED_KEY = Buffer.from([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]);

function deriveAgileIntermediate(password: string, salt: Buffer, spinCount: number): Buffer {
  const pw = Buffer.from(password, "utf16le");
  let h: Buffer = crypto.createHash("sha512").update(Buffer.concat([salt, pw])).digest();
  const iter = Buffer.allocUnsafe(4);
  for (let i = 0; i < spinCount; i++) {
    iter.writeUInt32LE(i, 0);
    h = crypto.createHash("sha512").update(Buffer.concat([iter, h])).digest();
  }
  return h;
}

function deriveKey(intermediate: Buffer, blockKey: Buffer, len = 32): Buffer {
  return crypto
    .createHash("sha512")
    .update(Buffer.concat([intermediate, blockKey]))
    .digest()
    .subarray(0, len);
}

function aesCbcEncryptNoPad(key: Buffer, iv: Buffer, plaintext: Buffer): Buffer {
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv.subarray(0, 16));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}

function buildMinimalCfb(streams: Array<{ name: string; data: Buffer }>): Buffer {
  const sectorSize = 512;
  const fatEntries: number[] = [];

  // Allocate sectors:
  // 0: FAT sector
  // 1: Directory sector
  // 2..: Stream sectors
  fatEntries[0] = FATSECT;
  fatEntries[1] = ENDOFCHAIN;

  const streamSectors: Buffer[] = [];
  let nextSect = 2;

  const dirEntries: Array<{
    name: string;
    objType: number;
    startSect: number;
    size: number;
  }> = [{ name: "Root Entry", objType: 5, startSect: ENDOFCHAIN, size: 0 }];

  for (const s of streams) {
    const startSect = nextSect;
    const count = Math.max(1, Math.ceil(s.data.length / sectorSize));
    for (let i = 0; i < count; i++) {
      const slice = s.data.subarray(i * sectorSize, (i + 1) * sectorSize);
      const secBuf = Buffer.alloc(sectorSize, 0);
      slice.copy(secBuf, 0);
      streamSectors.push(secBuf);
      fatEntries[nextSect] = i === count - 1 ? ENDOFCHAIN : nextSect + 1;
      nextSect++;
    }
    dirEntries.push({
      name: s.name,
      objType: 2,
      startSect,
      size: s.data.length,
    });
  }

  // Pad FAT to full sector (128 entries)
  while (fatEntries.length < 128) fatEntries.push(FREESECT);

  const fatSector = Buffer.alloc(sectorSize, 0xff);
  for (let i = 0; i < 128; i++) {
    fatSector.writeUInt32LE((fatEntries[i] ?? FREESECT) >>> 0, i * 4);
  }

  const dirSector = Buffer.alloc(sectorSize, 0);
  dirEntries.forEach((entry, idx) => {
    const off = idx * 128;
    const nameBuf = Buffer.from(entry.name, "utf16le");
    nameBuf.copy(dirSector, off);
    dirSector.writeUInt16LE(nameBuf.length + 2, off + 64);
    dirSector.writeUInt8(entry.objType, off + 66);
    dirSector.writeUInt32LE(entry.startSect >>> 0, off + 116);
    dirSector.writeUInt32LE(entry.size >>> 0, off + 120);
  });

  const header = Buffer.alloc(sectorSize, 0);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header, 0);
  header.writeUInt16LE(0x003e, 24);
  header.writeUInt16LE(0x0003, 26);
  header.writeUInt16LE(0xfffe, 28);
  header.writeUInt16LE(9, 30); // sectorShift = 512
  header.writeUInt16LE(6, 32); // miniSectorShift = 64
  header.writeUInt32LE(1, 44); // 1 FAT sector
  header.writeUInt32LE(1, 48); // firstDirSector = 1
  header.writeUInt32LE(4096, 56); // miniCutoff
  header.writeUInt32LE(ENDOFCHAIN >>> 0, 60); // firstMiniFatSector
  header.writeUInt32LE(ENDOFCHAIN >>> 0, 68); // firstDifatSector
  header.writeUInt32LE(0, 72); // totalDifatSectors
  for (let i = 0; i < 109; i++) {
    header.writeUInt32LE((i === 0 ? 0 : FREESECT) >>> 0, 76 + i * 4);
  }

  return Buffer.concat([header, fatSector, dirSector, ...streamSectors]);
}

function buildAgileEncryptedPackage(plainZip: Buffer, password: string): Buffer {
  const spinCount = 200;
  const keySalt = crypto.randomBytes(16);
  const pkgSalt = crypto.randomBytes(16);
  const packageKey = crypto.randomBytes(32);
  const verifierInput = crypto.randomBytes(16);
  const verifierHash = crypto.createHash("sha512").update(verifierInput).digest();

  const intermediate = deriveAgileIntermediate(password, keySalt, spinCount);
  const encVerifierInput = aesCbcEncryptNoPad(
    deriveKey(intermediate, BLOCK_VERIFIER_INPUT),
    keySalt,
    verifierInput,
  );
  const encVerifierValue = aesCbcEncryptNoPad(
    deriveKey(intermediate, BLOCK_VERIFIER_VALUE),
    keySalt,
    verifierHash,
  );
  const encPackageKey = aesCbcEncryptNoPad(
    deriveKey(intermediate, BLOCK_ENCRYPTED_KEY),
    keySalt,
    packageKey,
  );

  const xml =
    `<encryption xmlns="http://schemas.microsoft.com/office/2006/encryption" ` +
    `xmlns:p="http://schemas.microsoft.com/office/2006/keyEncryptor/password">` +
    `<keyData saltSize="16" blockSize="16" keyBits="256" hashSize="64" ` +
    `cipherAlgorithm="AES" cipherChaining="ChainingModeCBC" hashAlgorithm="SHA512" ` +
    `saltValue="${pkgSalt.toString("base64")}"/>` +
    `<keyEncryptors><keyEncryptor uri="http://schemas.microsoft.com/office/2006/keyEncryptor/password">` +
    `<p:encryptedKey spinCount="${spinCount}" saltSize="16" blockSize="16" keyBits="256" hashSize="64" ` +
    `cipherAlgorithm="AES" cipherChaining="ChainingModeCBC" hashAlgorithm="SHA512" ` +
    `saltValue="${keySalt.toString("base64")}" ` +
    `encryptedVerifierHashInput="${encVerifierInput.toString("base64")}" ` +
    `encryptedVerifierHashValue="${encVerifierValue.toString("base64")}" ` +
    `encryptedKeyValue="${encPackageKey.toString("base64")}"/>` +
    `</keyEncryptor></keyEncryptors></encryption>`;

  const encInfoHeader = Buffer.alloc(8, 0);
  encInfoHeader.writeUInt16LE(4, 0);
  encInfoHeader.writeUInt16LE(4, 2);
  encInfoHeader.writeUInt32LE(0x40, 4);
  const encryptionInfo = Buffer.concat([encInfoHeader, Buffer.from(xml, "utf8")]);

  const sizeHeader = Buffer.alloc(8, 0);
  sizeHeader.writeBigUInt64LE(BigInt(plainZip.length), 0);

  const segSize = 4096;
  const encChunks: Buffer[] = [sizeHeader];
  const segIdx = Buffer.allocUnsafe(4);
  for (let seg = 0; seg * segSize < plainZip.length; seg++) {
    let chunk: Buffer = plainZip.subarray(seg * segSize, Math.min(plainZip.length, (seg + 1) * segSize));
    const rem = chunk.length % 16;
    if (rem !== 0) {
      chunk = Buffer.concat([chunk, Buffer.alloc(16 - rem, 0)]);
    }
    segIdx.writeUInt32LE(seg, 0);
    const iv = crypto.createHash("sha512").update(Buffer.concat([pkgSalt, segIdx])).digest().subarray(0, 16);
    encChunks.push(aesCbcEncryptNoPad(packageKey, iv, chunk));
  }

  return buildMinimalCfb([
    { name: "EncryptionInfo", data: encryptionInfo },
    { name: "EncryptedPackage", data: Buffer.concat(encChunks) },
  ]);
}

async function createSampleDocxZip(text: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
      `</Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("MS-OFFCRYPTO Agile OOXML decryptor (FR.IA.06B)", () => {
  it("throws KEY_ENCRYPTED when password is missing", async () => {
    const zip = await createSampleDocxZip("Kunci Jawaban Nomor 1: Keselamatan Kerja");
    const cfb = buildAgileEncryptedPackage(zip, "SandiLSP!2026");

    expect(() => decryptAgileOoxmlBuffer(cfb, "")).toThrow(/KEY_ENCRYPTED/);
  });

  it("throws KEY_WRONG_PASSWORD when password is incorrect", async () => {
    const zip = await createSampleDocxZip("Kunci Jawaban Nomor 1: Keselamatan Kerja");
    const cfb = buildAgileEncryptedPackage(zip, "SandiBenar!2026");

    expect(() => decryptAgileOoxmlBuffer(cfb, "SandiSalah")).toThrow(/KEY_WRONG_PASSWORD/);
  });

  it("decrypts to the exact OOXML ZIP and parses text via parseMasterKey06bFile", async () => {
    const expectedText = "Kunci Jawaban Resmi FR.IA.06B Soal 1: Hirarki Pengendalian Risiko K3";
    const zip = await createSampleDocxZip(expectedText);
    const cfb = buildAgileEncryptedPackage(zip, "K3Rahasia#06B");

    const decrypted = decryptAgileOoxmlBuffer(cfb, "K3Rahasia#06B");
    expect(decrypted.equals(zip)).toBe(true);

    const extracted = await extractTextFromDocx(decrypted);
    expect(extracted.text).toContain(expectedText);

    const fakeFile = new File([new Uint8Array(cfb)], "FR.IA.06B_Encrypted.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const withoutPwd = await parseMasterKey06bFile(fakeFile);
    expect(withoutPwd.ok).toBe(false);
    if (!withoutPwd.ok) {
      expect(withoutPwd.error).toMatch(/KEY_ENCRYPTED/);
    }

    const withPwd = await parseMasterKey06bFile(fakeFile, "K3Rahasia#06B");
    expect(withPwd.ok).toBe(true);
    if (withPwd.ok) {
      expect(withPwd.extractionMethod).toBe("ooxml_docx");
      expect(withPwd.text).toContain(expectedText);
    }
  });
});
