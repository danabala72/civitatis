import "dotenv/config";

export const config = {
  civitatis: {
    baseUrl: process.env.CIVITATIS_BASE_URL,
    providerUrl: process.env.CIVITATIS_PROVIDER_URL,
    bookingsUrl: process.env.CIVITATIS_BOOKINGS_URL,

    username: process.env.CIVITATIS_USERNAME,
    password: process.env.CIVITATIS_PASSWORD,
  },

  browser: {
    executablePath: process.env.BROWSER_EXECUTABLE_PATH,

    userDataDir:
      process.env.BROWSER_USER_DATA_DIR || "./data/browser-profile",

    headless:
      process.env.BROWSER_HEADLESS === "true",
  },
  gmail: {
    user: process.env.GMAIL_USER,

    clientId:
      process.env.GOOGLE_CLIENT_ID,

    clientSecret:
      process.env.GOOGLE_CLIENT_SECRET,

    refreshToken:
      process.env.GOOGLE_REFRESH_TOKEN,

    otpFrom:
      process.env.CIVITATIS_OTP_FROM,

    otpSubject:
      process.env.CIVITATIS_OTP_SUBJECT,
  },
   otp: {
    timeoutMs:
      Number(
        process.env.CIVITATIS_OTP_TIMEOUT_MS
      ) || 120000,

    pollIntervalMs:
      Number(
        process.env.CIVITATIS_OTP_POLL_INTERVAL_MS
      ) || 3000,
  },
};