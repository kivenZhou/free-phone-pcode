import { anonymsmsProvider } from "./anonymsms";
import { freephonenumProvider } from "./freephonenum";
import { goinsmsProvider, mianfeismsProvider } from "./sms-php-sites";
import { onlinesimProvider } from "./onlinesim";
import { receiveSmssProvider } from "./receive-smss";
import { sms24Provider } from "./sms24";
import { smscodeonlineProvider } from "./smscodeonline";
import { smstomeProvider } from "./smstome";
import { storytrainProvider } from "./storytrain";
import { yunduanxinProvider } from "./yunduanxin";
import { yunjiemaProvider } from "./yunjiema";
import { yunjiematopProvider } from "./yunjiematop";
import { zsrqProvider } from "./zsrq";
import type { SmsProvider } from "./types";

export { PROVIDER_LABELS } from "../provider-labels";

const ALL_PROVIDERS: SmsProvider[] = [
  onlinesimProvider,
  freephonenumProvider,
  smscodeonlineProvider,
  mianfeismsProvider,
  goinsmsProvider,
  yunjiemaProvider,
  yunduanxinProvider,
  yunjiematopProvider,
  storytrainProvider,
  anonymsmsProvider,
  zsrqProvider,
  receiveSmssProvider,
  sms24Provider,
  smstomeProvider,
];

function disabledIds(): Set<string> {
  const raw = process.env.DISABLED_PROVIDERS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function getProviders(): SmsProvider[] {
  const disabled = disabledIds();
  return ALL_PROVIDERS.filter((p) => !disabled.has(p.id));
}

export function getProvider(id: string): SmsProvider | undefined {
  return getProviders().find((p) => p.id === id);
}

export function listProviderMeta() {
  const disabled = disabledIds();
  return ALL_PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    enabled: !disabled.has(p.id),
  }));
}
