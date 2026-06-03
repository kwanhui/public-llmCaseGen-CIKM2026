import { randomBytes } from "node:crypto";

// Base64url-safe (RFC 4648 §5) — no padding, no `+`/`/`. Suitable for URLs.
function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function newInviteToken(): string {
  return base64url(randomBytes(24));
}
