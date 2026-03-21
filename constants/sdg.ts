/**
 * SDG 標籤（App 唯一來源）：聯合國官方色 + 8 位 hex 透明度（…18 ≈ 10% 底色），文字為對應深色。
 * `public.sdgs` 若存在，建議與此表同步（僅供 SQL／報表／未來後台），UI 不讀 DB。
 */

export type SdgColorEntry = {
  bg: string;
  text: string;
  label: string;
};

export const SDG_COLORS: Record<number, SdgColorEntry> = {
  1: { bg: "#E5243B18", text: "#8b0012", label: "消除貧窮" },
  2: { bg: "#DDA63A18", text: "#7a4f00", label: "消除飢餓" },
  3: { bg: "#4C9F3818", text: "#1e5015", label: "健康與福祉" },
  4: { bg: "#C5192D18", text: "#7a0010", label: "優質教育" },
  5: { bg: "#FF3A2118", text: "#991500", label: "性別平等" },
  6: { bg: "#26BDE218", text: "#084d6d", label: "淨水及衛生" },
  7: { bg: "#FCC30B18", text: "#6b4e00", label: "潔淨能源" },
  8: { bg: "#A2194218", text: "#5c0020", label: "尊嚴就業" },
  9: { bg: "#FD692518", text: "#8b3000", label: "產業創新" },
  10: { bg: "#DD136718", text: "#7a0035", label: "減少不平等" },
  11: { bg: "#FD9D2418", text: "#7a3d00", label: "永續城鄉" },
  12: { bg: "#BF8B2E18", text: "#5c3a00", label: "責任消費" },
  13: { bg: "#3F7E4418", text: "#1a3d1e", label: "氣候行動" },
  14: { bg: "#0A97D918", text: "#084d6d", label: "保育海洋" },
  15: { bg: "#56C02B18", text: "#265c0a", label: "保育陸域" },
  16: { bg: "#00689D18", text: "#003d5c", label: "和平正義" },
  17: { bg: "#19486A18", text: "#0d2a40", label: "全球夥伴" },
};

export type SdgDef = { id: number } & SdgColorEntry;

/** 依編號排序，供表單等處迭代 */
export const SDG_DEFINITIONS: SdgDef[] = (
  Object.keys(SDG_COLORS) as unknown as `${number}`[]
)
  .map(Number)
  .sort((a, b) => a - b)
  .map((id) => ({ id, ...SDG_COLORS[id] }));

export function getSdgById(id: number): SdgDef | undefined {
  const c = SDG_COLORS[id];
  if (!c) return undefined;
  return { id, ...c };
}
