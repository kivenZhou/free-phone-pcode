import type { LineType } from "./phone";
import type { NormalizedMessage, NormalizedNumber, ProviderHealth } from "./providers/types";

export interface StoredNumber extends NormalizedNumber {
  id: string;
  updatedAt: number;
  nationalNumber: string;
  dialCode: string;
  countryIso: string;
  countryNameZh: string;
  flag: string;
  lineType: LineType;
}

export interface StoreShape {
  numbers: StoredNumber[];
  messages: Record<string, { messages: NormalizedMessage[]; fetchedAt: number }>;
  health: ProviderHealth[];
  syncMeta: Record<string, string>;
}

export const STORE_OBJECT_KEY = "store.json";

export function emptyStore(): StoreShape {
  return {
    numbers: [],
    messages: {},
    health: [],
    syncMeta: {},
  };
}
