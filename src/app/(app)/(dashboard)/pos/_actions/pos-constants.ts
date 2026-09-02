// The configurable TaxRate table was removed — every checkout now uses this
// fixed rate uniformly, with no per-item/category distinction.
//
// Kept out of pos-actions.ts: a 'use server' file may only export async
// functions, and a plain object export there crashes the whole module.
export const DEFAULT_VAT_RATE = { rate: 12, name: 'VAT' } as const
