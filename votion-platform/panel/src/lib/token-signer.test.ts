import { describe, it, expect } from "vitest";
import { TokenSigner } from "./token-signer";

describe("TokenSigner (Ed25519)", () => {
  it("should generate a valid Ed25519 keypair in hex format", () => {
    const pair = TokenSigner.generateKeyPair();
    expect(pair.publicKeyHex).toBeDefined();
    expect(pair.privateKeyHex).toBeDefined();
    expect(pair.publicKeyHex.length).toBeGreaterThan(60);
    expect(pair.privateKeyHex.length).toBeGreaterThan(60);
  });

  it("should sign and verify a ticket successfully", () => {
    const pair = TokenSigner.generateKeyPair();
    const token = TokenSigner.signTicket(
      {
        server_id: "srv-minecraft-01",
        user_id: "usr_alice",
        permissions: ["console.read", "console.write"],
      },
      pair.privateKeyHex,
      60
    );

    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const verification = TokenSigner.verifyTicket(token, pair.publicKeyHex);
    expect(verification.valid).toBe(true);
    expect(verification.payload?.server_id).toBe("srv-minecraft-01");
    expect(verification.payload?.user_id).toBe("usr_alice");
    expect(verification.payload?.permissions).toContain("console.write");
  });

  it("should reject tampered tickets", () => {
    const pair = TokenSigner.generateKeyPair();
    const token = TokenSigner.signTicket(
      {
        server_id: "srv-01",
        user_id: "usr_attacker",
        permissions: ["console.read"],
      },
      pair.privateKeyHex,
      60
    );

    const [header, payload, sig] = token.split(".");
    // Tamper with payload
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        server_id: "srv-01",
        user_id: "usr_attacker",
        permissions: ["console.read", "admin.all"],
      })
    ).toString("base64url");

    const tamperedToken = `${header}.${tamperedPayload}.${sig}`;
    const result = TokenSigner.verifyTicket(tamperedToken, pair.publicKeyHex);
    expect(result.valid).toBe(false);
  });

  it("should reject expired tickets", () => {
    const pair = TokenSigner.generateKeyPair();
    const expiredToken = TokenSigner.signTicket(
      {
        server_id: "srv-02",
        user_id: "usr_expired",
        permissions: ["console.read"],
      },
      pair.privateKeyHex,
      -10 // Expired 10 seconds ago
    );

    const result = TokenSigner.verifyTicket(expiredToken, pair.publicKeyHex);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("expired");
  });
});
