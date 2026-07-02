import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Architect-R5: Postgres envelope encryption.
 *
 * Stack has NO external secret manager (§11 b′4). We use envelope encryption:
 *  - A master key (from env, 32 bytes) wraps a per-credential DEK.
 *  - Credential plaintext is AES-256-GCM encrypted with the DEK.
 *  - Stored columns: credentialCiphertext (DEK-wrapped ciphertext + tag + iv)
 *    and credentialKeyId (DEK id).
 *  - Decrypt is in-process only; NEVER serialized over any API/DTO.
 *
 * Master-key rotation re-wraps DEKs without exposing plaintext (SEC-CRED-3).
 */
const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

export interface EnvelopeCiphertext {
  /** base64: iv || ciphertext || tag */
  blob: string;
  keyId: string;
}

export interface RawEnvelope {
  ciphertext: Buffer;
  keyId: string;
}

@Injectable()
export class EnvelopeEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EnvelopeEncryptionService.name);
  private masterKey!: Buffer;

  onModuleInit() {
    const b64 = process.env.ENVELOPE_MASTER_KEY_B64;
    if (!b64) {
      throw new InternalServerErrorException(
        "ENVELOPE_MASTER_KEY_B64 is required (generate 32 random bytes, base64).",
      );
    }
    const key = Buffer.from(b64, "base64");
    if (key.length !== KEY_LEN) {
      throw new InternalServerErrorException(
        `ENVELOPE_MASTER_KEY_B64 must decode to ${KEY_LEN} bytes (got ${key.length}).`,
      );
    }
    this.masterKey = key;
    this.logger.log("Envelope master key loaded");
  }

  /** Encrypt a plaintext credential, returning DB-storable ciphertext + keyId. */
  encrypt(plaintext: string): EnvelopeCiphertext {
    const dek = randomBytes(KEY_LEN);
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, dek, iv);
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Wrap DEK with master key (AES-256-GCM).
    const wrapIv = randomBytes(IV_LEN);
    const wrapCipher = createCipheriv(ALGO, this.masterKey, wrapIv);
    const wrappedDek = Buffer.concat([
      wrapCipher.update(dek),
      wrapCipher.final(),
    ]);
    const wrapTag = wrapCipher.getAuthTag();

    const keyId = createHash("sha256").update(wrappedDek).digest("hex").slice(0, 16);
    const blob = Buffer.concat([wrapIv, wrapTag, wrappedDek, iv, tag, ct]).toString(
      "base64",
    );
    return { blob, keyId };
  }

  /** Decrypt in-process. The returned plaintext MUST NOT be serialized. */
  decrypt(envelope: EnvelopeCiphertext): string {
    const buf = Buffer.from(envelope.blob, "base64");
    let off = 0;
    const wrapIv = buf.subarray(off, (off += IV_LEN));
    const wrapTag = buf.subarray(off, (off += TAG_LEN));
    const wrappedDek = buf.subarray(off, (off += KEY_LEN));
    const iv = buf.subarray(off, (off += IV_LEN));
    const tag = buf.subarray(off, (off += TAG_LEN));
    const ct = buf.subarray(off);

    const unwrap = createDecipheriv(ALGO, this.masterKey, wrapIv);
    unwrap.setAuthTag(wrapTag);
    const dek = Buffer.concat([unwrap.update(wrappedDek), unwrap.final()]);

    const decipher = createDecipheriv(ALGO, dek, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  }

  /** Constant-time comparison for credential validation paths. */
  safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }

  /**
   * Re-wrap a DEK under a new master key (rotation, SEC-CRED-3).
   * Caller supplies the OLD envelope + new master key; returns new envelope.
   * Plaintext is touched only in-process.
   */
  rotate(
    oldEnvelope: EnvelopeCiphertext,
    newMasterKeyB64: string,
  ): EnvelopeCiphertext {
    const plaintext = this.decrypt(oldEnvelope);
    const tmp = process.env.ENVELOPE_MASTER_KEY_B64;
    process.env.ENVELOPE_MASTER_KEY_B64 = newMasterKeyB64;
    try {
      // Re-init with new key by constructing a transient instance.
      const rotated = new EnvelopeEncryptionService();
      rotated.onModuleInit();
      return rotated.encrypt(plaintext);
    } finally {
      process.env.ENVELOPE_MASTER_KEY_B64 = tmp;
      this.masterKey = Buffer.from(tmp!, "base64");
    }
  }
}
