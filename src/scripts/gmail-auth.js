import fs from "node:fs";
import path from "node:path";

import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
];

const CREDENTIALS_PATH = path.join(
  process.cwd(),
  "credentials.json"
);

const TOKEN_PATH = path.join(
  process.cwd(),
  "gmail-token.json"
);

async function main() {
  console.log("[Gmail] Starting OAuth...");

  const auth = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });

  const tokens = auth.credentials;

  console.log("");
  console.log("[Gmail] OAuth successful.");
  console.log("");

  if (!tokens.refresh_token) {
    console.error(
      "[Gmail] No refresh token returned."
    );

    console.error(
      "Re-authorize the application to obtain a refresh token."
    );

    process.exit(1);
  }

  fs.writeFileSync(
    TOKEN_PATH,
    JSON.stringify(tokens, null, 2)
  );

  console.log(
    "[Gmail] Token saved to:",
    TOKEN_PATH
  );

  console.log("");
  console.log(
    "Refresh token:"
  );

  console.log(tokens.refresh_token);
}

main().catch((error) => {
  console.error("[Gmail] OAuth error:");
  console.error(error);
  process.exit(1);
});