// Hash a new admin password locally and push it to Vercel.
// Run: pnpm change-admin-password
// The plaintext is read from a hidden TTY prompt — never echoed, never an
// argument, never in shell history.

import { hash } from "bcryptjs";
import { spawnSync } from "node:child_process";

async function readPasswordHidden(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  if (!process.stdin.isTTY) {
    let buf = "";
    for await (const chunk of process.stdin) buf += String(chunk);
    return buf.trim();
  }
  return new Promise((resolve, reject) => {
    let pwd = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onData = (key: string) => {
      if (key === "\r" || key === "\n" || key === "") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(pwd);
      } else if (key === "") {
        process.stdout.write("\n");
        process.stdin.setRawMode(false);
        process.stdin.pause();
        reject(new Error("Cancelled"));
      } else if (key === "" || key === "\b") {
        if (pwd.length > 0) pwd = pwd.slice(0, -1);
      } else {
        pwd += key;
      }
    };
    process.stdin.on("data", onData);
  });
}

async function main() {
  const pwd = await readPasswordHidden("New admin password: ");
  if (pwd.length < 4) {
    console.error("Password too short (>=4 chars).");
    process.exit(1);
  }
  const confirm = await readPasswordHidden("Confirm password: ");
  if (confirm !== pwd) {
    console.error("Passwords don't match.");
    process.exit(1);
  }

  console.log("Hashing...");
  const h = await hash(pwd, 12);

  console.log("Removing old hash from Vercel (if present)...");
  spawnSync("vercel", ["env", "rm", "ADMIN_PASSWORD_HASH", "production", "--yes"], {
    stdio: ["ignore", "ignore", "inherit"],
  });

  console.log("Adding new hash to Vercel Production...");
  const add = spawnSync(
    "vercel",
    ["env", "add", "ADMIN_PASSWORD_HASH", "production", "--value", h, "--yes"],
    { stdio: "inherit" },
  );
  if (add.status !== 0) {
    console.error("Failed to add env var. Local hash:");
    console.log(h);
    console.error("Add it to .env.local manually if you only need it locally.");
    process.exit(1);
  }

  console.log("Triggering production redeploy...");
  const deploy = spawnSync("vercel", ["--prod", "--yes"], { stdio: "inherit" });
  if (deploy.status !== 0) {
    console.error("Redeploy failed.");
    process.exit(1);
  }
  console.log("Done. Admin password updated.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
