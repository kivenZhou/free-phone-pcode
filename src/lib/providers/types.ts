import type { LineType } from "../phone";

export interface NormalizedNumber {
  e164: string;
  country: string;
  countryCode: string;
  providerId: string;
  lastSeenAt: number;
  /** National significant number without dial code */
  nationalNumber?: string;
  /** E.164 country calling code digits */
  dialCode?: string;
  countryIso?: string;
  countryNameZh?: string;
  flag?: string;
  lineType?: LineType;
  meta?: Record<string, string>;
}

export interface NormalizedMessage {
  from: string;
  text: string;
  receivedAt: number;
  otp?: string;
}

export interface SmsProvider {
  id: string;
  name: string;
  /** Default line type for this free public source */
  defaultLineType?: LineType;
  listNumbers(): Promise<NormalizedNumber[]>;
  listMessages(
    number: string,
    meta?: Record<string, string>,
  ): Promise<NormalizedMessage[]>;
}

export type ProviderStatus = "ok" | "degraded" | "disabled";

export interface ProviderHealth {
  id: string;
  name: string;
  status: ProviderStatus;
  lastError?: string;
  lastSuccessAt?: number;
  numberCount?: number;
}
