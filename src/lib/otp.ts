/** Extract a likely OTP / verification code from SMS text. */
export function extractOtp(text: string): string | undefined {
  if (!text) return undefined;

  const patterns = [
    /(?:code|otp|pin|验证码|驗證碼|код|codigo|code\s*[:=])\s*[：:.]?\s*([0-9]{4,8})/i,
    /验证码[为為是：:\s]*([0-9]{4,8})/,
    /([0-9]{4,8})\s*是你的/,
    /\b([0-9]{4,8})\b(?:\s*(?:is|为|為|是)\s*(?:your|the)?\s*(?:code|otp|pin|验证码))?/i,
    /\bG-([0-9]{4,8})\b/,
    /\b([0-9]{3}\s?[0-9]{3})\b/,
    /\b([0-9]{6})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, "");
  }

  return undefined;
}
