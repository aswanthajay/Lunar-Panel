/**
 * Votion Platform - Ed25519 Console Ticket Generator & Verifier
 * 
 * Provides cryptographically signed, short-lived bearer tickets for authenticating
 * interactive WebSocket pseudo-terminal (PTY) connections between client browsers
 * and host daemons (votion-node).
 */

import crypto from "node:crypto";

export interface ConsoleTicketPayload {
  server_id: string;
  user_id: string;
  permissions: string[];
  issued_at: number; // Unix timestamp in seconds
  expires_at: number; // Unix timestamp in seconds
  nonce: string; // Random uniqueness string
}

export interface TicketHeader {
  alg: "Ed25519";
  typ: "VOTION-TICKET";
}

export class TokenSigner {
  private static base64UrlEncode(data: Buffer | string): string {
    const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    return buf
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  private static base64UrlDecode(str: string): Buffer {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    return Buffer.from(base64, "base64");
  }

  /**
   * Generates a new Ed25519 keypair formatted as DER / hex for configuration
   */
  public static generateKeyPair(): { publicKeyHex: string; privateKeyHex: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const pubExport = publicKey.export({ type: "spki", format: "der" });
    const privExport = privateKey.export({ type: "pkcs8", format: "der" });
    return {
      publicKeyHex: pubExport.toString("hex"),
      privateKeyHex: privExport.toString("hex"),
    };
  }

  /**
   * Signs a console ticket for a given server and user
   */
  public static signTicket(
    payload: Omit<ConsoleTicketPayload, "issued_at" | "expires_at" | "nonce">,
    privateKeyDerHex: string,
    ttlSeconds: number = 60
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: ConsoleTicketPayload = {
      ...payload,
      issued_at: now,
      expires_at: now + ttlSeconds,
      nonce: crypto.randomBytes(16).toString("hex"),
    };

    const header: TicketHeader = { alg: "Ed25519", typ: "VOTION-TICKET" };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(fullPayload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const privKey = crypto.createPrivateKey({
      key: Buffer.from(privateKeyDerHex, "hex"),
      format: "der",
      type: "pkcs8",
    });

    const signature = crypto.sign(null, Buffer.from(signingInput, "utf8"), privKey);
    const encodedSig = this.base64UrlEncode(signature);

    return `${signingInput}.${encodedSig}`;
  }

  /**
   * Verifies ticket signature, expiration, and payload integrity
   */
  public static verifyTicket(
    token: string,
    publicKeyDerHex: string
  ): { valid: boolean; payload?: ConsoleTicketPayload; error?: string } {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return { valid: false, error: "Malformed ticket format" };
      }

      const [encodedHeader, encodedPayload, encodedSig] = parts;
      const signingInput = `${encodedHeader}.${encodedPayload}`;
      const signature = this.base64UrlDecode(encodedSig);

      const pubKey = crypto.createPublicKey({
        key: Buffer.from(publicKeyDerHex, "hex"),
        format: "der",
        type: "spki",
      });

      const isVerified = crypto.verify(
        null,
        Buffer.from(signingInput, "utf8"),
        pubKey,
        signature
      );

      if (!isVerified) {
        return { valid: false, error: "Invalid cryptographic signature" };
      }

      const payloadJson = this.base64UrlDecode(encodedPayload).toString("utf8");
      const payload: ConsoleTicketPayload = JSON.parse(payloadJson);

      const now = Math.floor(Date.now() / 1000);
      if (payload.expires_at < now) {
        return { valid: false, error: "Ticket expired" };
      }

      return { valid: true, payload };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { valid: false, error: `Verification failed: ${msg}` };
    }
  }
}
