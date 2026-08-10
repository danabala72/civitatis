import { config } from "../config.js";
import { BrowserManager } from "../browser/browser-manager.js";
import { CivitatisProvider } from "../civitatis/civitatis-provider.js";
import { SessionManager } from "../session/session-manager.js";

const browserManager = new BrowserManager(config);

try {
  const page = await browserManager.start();

  const provider = new CivitatisProvider({
    page,
    config,
    otpService: null,
  });

  const sessionManager = new SessionManager({
    page,
    provider,
  });

  const valid = await sessionManager.check();

  console.log(
    valid
      ? "SESSION_VALID"
      : "SESSION_INVALID"
  );
} finally {
  await browserManager.stop();
}