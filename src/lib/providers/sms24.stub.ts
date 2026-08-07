import type { SmsProvider } from "./types";

/** Placeholder when native TLS modules are excluded (e.g. Cloudflare Workers build). */
export const sms24Provider: SmsProvider = {
  id: "sms24",
  name: "SMS24",

  async listNumbers() {
    throw new Error("SMS24 is unavailable without native modules");
  },

  async listMessages() {
    throw new Error("SMS24 is unavailable without native modules");
  },
};
