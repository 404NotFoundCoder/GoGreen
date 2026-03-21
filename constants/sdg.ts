/** SDG 標籤與官方色系（不套用主色系） */

export type SdgDef = {
  id: number;
  label: string;
  color: string;
  textColor: string;
};

export const SDG_DEFINITIONS: SdgDef[] = [
  { id: 1, label: "消除貧窮", color: "#E5243B", textColor: "#ffffff" },
  { id: 2, label: "消除飢餓", color: "#DDA63A", textColor: "#1a1a1a" },
  { id: 3, label: "健康與福祉", color: "#4C9F38", textColor: "#ffffff" },
  { id: 4, label: "優質教育", color: "#C5192D", textColor: "#ffffff" },
  { id: 5, label: "性別平等", color: "#FF3A21", textColor: "#ffffff" },
  { id: 6, label: "淨水與衛生", color: "#26BDE2", textColor: "#1a1a1a" },
  { id: 7, label: "可負擔的潔淨能源", color: "#FCC30B", textColor: "#1a1a1a" },
  { id: 8, label: "尊嚴就業與經濟發展", color: "#A21942", textColor: "#ffffff" },
  { id: 9, label: "產業創新與基礎建設", color: "#FD6925", textColor: "#ffffff" },
  { id: 10, label: "減少不平等", color: "#DD1367", textColor: "#ffffff" },
  { id: 11, label: "永續城市與社區", color: "#FD9D24", textColor: "#1a1a1a" },
  { id: 12, label: "負責任的消費與生產", color: "#BF8B2E", textColor: "#ffffff" },
  { id: 13, label: "氣候行動", color: "#3F7E44", textColor: "#ffffff" },
  { id: 14, label: "保育海洋生態", color: "#0A97D9", textColor: "#ffffff" },
  { id: 15, label: "保育陸域生態", color: "#56C02B", textColor: "#1a1a1a" },
  { id: 16, label: "和平正義與健全制度", color: "#00689D", textColor: "#ffffff" },
  { id: 17, label: "全球夥伴", color: "#19486A", textColor: "#ffffff" },
];

export function getSdgById(id: number): SdgDef | undefined {
  return SDG_DEFINITIONS.find((s) => s.id === id);
}
