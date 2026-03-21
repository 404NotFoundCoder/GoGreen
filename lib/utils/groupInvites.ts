/** 解析多筆信箱：逗號、分號、換行、中英文標點皆可。 */
export function parseInviteEmails(raw: string): string[] {
  const parts = raw
    .split(/[\s,;，；\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}
