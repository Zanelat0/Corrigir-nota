// Shared synthetic identity: automated fixtures and the offline visual demo only.
export const SYNTHETIC_CNPJ = "11222333000181";
export function syntheticAccessKey(tpEmis: string, model: "55" | "65") {
  const base = `422609${SYNTHETIC_CNPJ}${model}001000000042${tpEmis}12345678`;
  let sum = 0; let weight = 2;
  for (let i = base.length - 1; i >= 0; i--) { sum += Number(base[i]) * weight; weight = weight === 9 ? 2 : weight + 1; }
  return base + (sum % 11 < 2 ? 0 : 11 - sum % 11);
}
