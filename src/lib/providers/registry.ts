import { anonymsmsProvider } from "./anonymsms";
import { freephonenumProvider } from "./freephonenum";
import { goinsmsProvider, mianfeismsProvider } from "./sms-php-sites";
import { onlinesimProvider } from "./onlinesim";
import { receiveSmssProvider } from "./receive-smss";
import { smscodeonlineProvider } from "./smscodeonline";
import { smstomeProvider } from "./smstome";
import { storytrainProvider } from "./storytrain";
import { yunduanxinProvider } from "./yunduanxin";
import { yunjiemaProvider } from "./yunjiema";
import { yunjiematopProvider } from "./yunjiematop";
import { zsrqProvider } from "./zsrq";
import type { SmsProvider } from "./types";

export { PROVIDER_LABELS } from "../provider-labels";

const CORE_PROVIDERS: SmsProvider[] = [
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
  smstomeProvider,
];

const NATIVE_PROVIDER_META = [{ id: "sms24", name: "SMS24" }] as const;

function disabledIds(): Set<string> {
  const raw = process.env.DISABLED_PROVIDERS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function nativeModulesEnabled(): boolean {
  return process.env.SKIP_NATIVE_MODULES !== "1";
}

let nativeProvidersPromise: Promise<SmsProvider[]> | null = null;

async function loadNativeProviders(): Promise<SmsProvider[]> {
  if (!nativeModulesEnabled() || disabledIds().has("sms24")) {
    return [];
  }

  if (!nativeProvidersPromise) {
    nativeProvidersPromise = (async () => {
      try {
        const { sms24Provider } = await import("./sms24");
        return [sms24Provider];
      } catch (err) {
        console.warn(
          "Native SMS providers unavailable:",
          err instanceof Error ? err.message : String(err),
        );
        return [];
      }
    })();
  }

  return nativeProvidersPromise;
}

export async function getProviders(): Promise<SmsProvider[]> {
  const disabled = disabledIds();
  const native = await loadNativeProviders();
  return [...CORE_PROVIDERS, ...native].filter((p) => !disabled.has(p.id));
}

export async function getProvider(id: string): Promise<SmsProvider | undefined> {
  if (disabledIds().has(id)) return undefined;

  const core = CORE_PROVIDERS.find((p) => p.id === id);
  if (core) return core;

  if (!nativeModulesEnabled()) return undefined;

  const native = await loadNativeProviders();
  return native.find((p) => p.id === id);
}

export function listProviderMeta() {
  const disabled = disabledIds();
  const skipNative = !nativeModulesEnabled();

  return [
    ...CORE_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      enabled: !disabled.has(p.id),
    })),
    ...NATIVE_PROVIDER_META.map((p) => ({
      id: p.id,
      name: p.name,
      enabled: !disabled.has(p.id) && !skipNative,
    })),
  ];
}
