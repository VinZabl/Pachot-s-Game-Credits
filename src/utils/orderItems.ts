import { CartItem } from '../types';

/**
 * Aggregates order items that are identical (same product, variation, add-ons, unit price)
 * into single entries with combined quantity. Fixes display when GameItemOrderModal
 * stores quantity N as N separate items with quantity 1.
 */
export function aggregateOrderItems(items: CartItem[]): CartItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const map = new Map<string, CartItem>();

  for (const item of items) {
    const addonsKey = item.selectedAddOns?.length
      ? item.selectedAddOns
          .map((a) => `${a.id}:${a.quantity ?? 1}`)
          .sort()
          .join(',')
      : '';
    const key = [
      item.name,
      item.selectedVariation?.id ?? item.selectedVariation?.name ?? '',
      addonsKey,
      String(item.totalPrice ?? 0),
    ].join('|');

    const existing = map.get(key);
    const qty = item.quantity ?? 1;

    if (existing) {
      existing.quantity += qty;
    } else {
      map.set(key, { ...item, quantity: qty });
    }
  }

  return Array.from(map.values());
}
