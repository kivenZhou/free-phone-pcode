export type LineType = "virtual" | "physical" | "unknown";

export interface ParsedPhone {
  e164: string;
  dialCode: string;
  nationalNumber: string;
  countryIso: string;
  countryNameZh: string;
  flag: string;
  lineType: LineType;
}

/** Longest-match dial codes → ISO + Chinese name */
const DIAL_RULES: Array<[string, string, string]> = [
  ["998", "UZ", "乌兹别克斯坦"],
  ["886", "TW", "台湾"],
  ["880", "BD", "孟加拉"],
  ["852", "HK", "香港"],
  ["853", "MO", "澳门"],
  ["855", "KH", "柬埔寨"],
  ["856", "LA", "老挝"],
  ["880", "BD", "孟加拉"],
  ["971", "AE", "阿联酋"],
  ["966", "SA", "沙特"],
  ["964", "IQ", "伊拉克"],
  ["962", "JO", "约旦"],
  ["961", "LB", "黎巴嫩"],
  ["380", "UA", "乌克兰"],
  ["381", "RS", "塞尔维亚"],
  ["385", "HR", "克罗地亚"],
  ["386", "SI", "斯洛文尼亚"],
  ["358", "FI", "芬兰"],
  ["359", "BG", "保加利亚"],
  ["370", "LT", "立陶宛"],
  ["371", "LV", "拉脱维亚"],
  ["372", "EE", "爱沙尼亚"],
  ["351", "PT", "葡萄牙"],
  ["353", "IE", "爱尔兰"],
  ["354", "IS", "冰岛"],
  ["355", "AL", "阿尔巴尼亚"],
  ["356", "MT", "马耳他"],
  ["357", "CY", "塞浦路斯"],
  ["420", "CZ", "捷克"],
  ["421", "SK", "斯洛伐克"],
  ["389", "MK", "北马其顿"],
  ["234", "NG", "尼日利亚"],
  ["254", "KE", "肯尼亚"],
  ["212", "MA", "摩洛哥"],
  ["213", "DZ", "阿尔及利亚"],
  ["216", "TN", "突尼斯"],
  ["218", "LY", "利比亚"],
  ["249", "SD", "苏丹"],
  ["251", "ET", "埃塞俄比亚"],
  ["27", "ZA", "南非"],
  ["20", "EG", "埃及"],
  ["86", "CN", "中国"],
  ["84", "VN", "越南"],
  ["82", "KR", "韩国"],
  ["81", "JP", "日本"],
  ["66", "TH", "泰国"],
  ["65", "SG", "新加坡"],
  ["64", "NZ", "新西兰"],
  ["63", "PH", "菲律宾"],
  ["62", "ID", "印度尼西亚"],
  ["61", "AU", "澳大利亚"],
  ["60", "MY", "马来西亚"],
  ["55", "BR", "巴西"],
  ["54", "AR", "阿根廷"],
  ["52", "MX", "墨西哥"],
  ["51", "PE", "秘鲁"],
  ["48", "PL", "波兰"],
  ["47", "NO", "挪威"],
  ["46", "SE", "瑞典"],
  ["45", "DK", "丹麦"],
  ["44", "GB", "英国"],
  ["43", "AT", "奥地利"],
  ["41", "CH", "瑞士"],
  ["40", "RO", "罗马尼亚"],
  ["39", "IT", "意大利"],
  ["36", "HU", "匈牙利"],
  ["34", "ES", "西班牙"],
  ["33", "FR", "法国"],
  ["32", "BE", "比利时"],
  ["31", "NL", "荷兰"],
  ["30", "GR", "希腊"],
  ["91", "IN", "印度"],
  ["90", "TR", "土耳其"],
  ["7", "RU", "俄罗斯"],
  ["1", "US", "美国"],
];

const NAME_TO_ISO: Record<string, string> = {
  usa: "US",
  "united states": "US",
  "united states / canada": "US",
  canada: "CA",
  britain: "GB",
  "united kingdom": "GB",
  uk: "GB",
  france: "FR",
  germany: "DE",
  spain: "ES",
  italy: "IT",
  netherlands: "NL",
  sweden: "SE",
  australia: "AU",
  russia: "RU",
  china: "CN",
  中国: "CN",
  香港: "HK",
  台湾: "TW",
  澳门: "MO",
  vietnam: "VN",
  indonesia: "ID",
  india: "IN",
  uzbekistan: "UZ",
  finland: "FI",
  denmark: "DK",
  belgium: "BE",
  austria: "AT",
  switzerland: "CH",
  greece: "GR",
  hungary: "HU",
  bulgaria: "BG",
  croatia: "HR",
  latvia: "LV",
  slovakia: "SK",
  colombia: "CO",
  "north macedonia": "MK",
  马来西亚: "MY",
  unknown: "XX",
};

/** Provider default line type for free public inboxes. */
const PROVIDER_LINE_TYPE: Record<string, LineType> = {
  onlinesim: "virtual",
  freephonenum: "virtual",
  smscodeonline: "virtual",
  anonymsms: "virtual",
  "receive-smss": "virtual",
  sms24: "virtual",
  smstome: "virtual",
  receiveasms: "virtual",
  // Chinese public gates are usually shared virtual / cloud routes
  yunjiema: "virtual",
  yunduanxin: "virtual",
  yunjiematop: "virtual",
  storytrain: "virtual",
  mianfeisms: "virtual",
  goinsms: "virtual",
  zsrq: "virtual",
  mianfeijiema: "virtual",
};

export function isoToFlag(iso: string): string {
  if (!iso || iso.length !== 2 || iso === "XX") return "🌐";
  const code = iso.toUpperCase();
  return String.fromCodePoint(
    ...[...code].map((c) => 127397 + c.charCodeAt(0)),
  );
}

export function flagToIso(flag: string): string | null {
  if (flag === "🌐") return null;
  const points = [...flag].map((c) => c.codePointAt(0) || 0);
  if (points.length < 2) return null;
  return String.fromCharCode(points[0] - 127397, points[1] - 127397);
}

function resolveFromDial(digits: string): { dialCode: string; iso: string; nameZh: string } {
  const sorted = [...DIAL_RULES].sort((a, b) => b[0].length - a[0].length);
  for (const [code, iso, nameZh] of sorted) {
    if (digits.startsWith(code)) {
      return { dialCode: code, iso, nameZh };
    }
  }
  return { dialCode: "", iso: "XX", nameZh: "未知地区" };
}

function resolveFromCountryHint(country?: string, countryCode?: string): {
  dialCode: string;
  iso: string;
  nameZh: string;
} | null {
  if (countryCode && /^\d+$/.test(countryCode)) {
    const hit = DIAL_RULES.find(([c]) => c === countryCode);
    if (hit) return { dialCode: hit[0], iso: hit[1], nameZh: hit[2] };
  }
  if (country) {
    const key = country.trim().toLowerCase();
    const iso = NAME_TO_ISO[key];
    if (iso) {
      const hit = DIAL_RULES.find(([, i]) => i === iso);
      if (hit) return { dialCode: hit[0], iso: hit[1], nameZh: hit[2] };
      return { dialCode: countryCode || "", iso, nameZh: country };
    }
  }
  return null;
}

export function formatNational(national: string): string {
  return national.replace(/\D/g, "");
}

export function parsePhone(input: {
  e164: string;
  country?: string;
  countryCode?: string;
  providerId?: string;
  lineType?: LineType;
  meta?: Record<string, string>;
}): ParsedPhone {
  const digits = input.e164.replace(/\D/g, "");
  const hint = resolveFromCountryHint(input.country, input.countryCode);
  const fromDial = resolveFromDial(digits);

  let dialCode = hint?.dialCode || fromDial.dialCode;
  let iso = hint?.iso || fromDial.iso;
  let nameZh = hint?.nameZh || fromDial.nameZh;

  // Prefer dial-code match when hint dial doesn't prefix the number
  if (dialCode && !digits.startsWith(dialCode) && fromDial.dialCode) {
    dialCode = fromDial.dialCode;
    iso = fromDial.iso;
    nameZh = fromDial.nameZh;
  }

  // Canada heuristic: +1 with country hint Canada
  if (dialCode === "1" && /canada/i.test(input.country || "")) {
    iso = "CA";
    nameZh = "加拿大";
  }

  const nationalNumber = dialCode ? digits.slice(dialCode.length) : digits;
  const e164 = `+${digits}`;

  const metaType = input.meta?.lineType as LineType | undefined;
  const lineType: LineType =
    input.lineType ||
    metaType ||
    (input.providerId ? PROVIDER_LINE_TYPE[input.providerId] : undefined) ||
    "unknown";

  return {
    e164,
    dialCode,
    nationalNumber,
    countryIso: iso,
    countryNameZh: nameZh,
    flag: isoToFlag(iso),
    lineType,
  };
}

export function lineTypeLabel(type: LineType): string {
  if (type === "physical") return "实体卡";
  if (type === "virtual") return "虚拟号";
  return "类型未知";
}
