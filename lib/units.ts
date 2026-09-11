// Unit system: every unit defined as grams or millilitres for exact conversion.
// piece/pack units are counted, not converted.

export interface UnitDef {
  code: string;
  label: string;
  /** conversion factor to grams (mass) or millilitres (volume); null for counted units */
  factor: number | null;
  /** which base unit codes this unit can convert with */
  family: "mass" | "volume" | "count";
  /** order for descending dropdown (KG > G, L > mL) */
  rank: number;
}

export const UNITS: UnitDef[] = [
  { code: "kg", label: "KG", factor: 1000, family: "mass", rank: 1 },
  { code: "g", label: "G", factor: 1, family: "mass", rank: 2 },
  { code: "l", label: "L", factor: 1000, family: "volume", rank: 3 },
  { code: "ml", label: "ML", factor: 1, family: "volume", rank: 4 },
  { code: "piece", label: "Piece", factor: null, family: "count", rank: 5 },
  { code: "pack", label: "Pack", factor: null, family: "count", rank: 6 },
  { code: "dozen", label: "Dozen", factor: null, family: "count", rank: 7 },
  { code: "meter", label: "Meter", factor: null, family: "count", rank: 8 },
  { code: "hour", label: "Hour", factor: null, family: "count", rank: 9 },
  { code: "day", label: "Day", factor: null, family: "count", rank: 10 },
  { code: "job", label: "Job", factor: null, family: "count", rank: 11 },
];

export const unitByCode = (code: string): UnitDef | undefined =>
  UNITS.find((u) => u.code === code);

export const unitLabel = (code: string): string => unitByCode(code)?.label ?? code;

/** Units that can inter-convert with the given unit, in descending dropdown order (KG>G, L>mL). */
export function convertibleUnits(code: string): UnitDef[] {
  const u = unitByCode(code);
  if (!u) return [];
  const sameFamily = UNITS.filter((x) => x.family === u.family);
  return sameFamily.sort((a, b) => a.rank - b.rank);
}

/**
 * Effective price per 1 selected unit, given the item's base definition.
 * Example: item = 1 kg rice @ ₹100 → selecting "g" gives rate 0.1 (₹0.10 per gram).
 */
export function ratePerUnit(baseQty: number, baseUnit: string, price: number, selUnit: string): number {
  const b = unitByCode(baseUnit);
  const s = unitByCode(selUnit);
  if (!b || !s) return price / (baseQty || 1);
  const baseAmount = b.factor !== null ? b.factor * baseQty : baseQty; // grams/ml or count
  const selAmount = s.factor !== null ? s.factor : 1;
  if (baseAmount <= 0) return price;
  return price / baseAmount * selAmount;
}
