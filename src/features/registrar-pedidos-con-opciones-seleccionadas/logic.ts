export const EMPTY_ORDER_MESSAGE = "Debe agregar al menos un producto al pedido";

export interface Producto {
  id: string;
  name: string;
  basePrice: number;
}

export interface Ingrediente {
  id: string;
  name: string;
  price: number;
  stock: number;
  minLevel: number;
}

export interface OpcionSeleccionada {
  ingredientId: string;
  name: string;
  price: number;
}

export interface ItemPedido {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  options: OpcionSeleccionada[];
}

export interface PedidoInput {
  productId: string;
  quantity: number;
  ingredientIds: string[];
}

export function ingredientAvailable(
  ingrediente: Pick<Ingrediente, "stock" | "minLevel">,
): boolean {
  return ingrediente.stock > ingrediente.minLevel;
}

export function computeUnitPrice(
  basePrice: number,
  options: Pick<OpcionSeleccionada, "price">[],
): number {
  return basePrice + options.reduce((acc, option) => acc + option.price, 0);
}

export function buildItem(
  product: Producto,
  quantity: number,
  options: OpcionSeleccionada[],
  id?: string,
): ItemPedido {
  return {
    id: id ?? `item_${crypto.randomUUID()}`,
    productId: product.id,
    productName: product.name,
    quantity,
    unitPrice: computeUnitPrice(product.basePrice, options),
    options,
  };
}

export function itemSubtotal(item: ItemPedido): number {
  return item.unitPrice * item.quantity;
}

export function computeTotal(items: ItemPedido[]): number {
  return items.reduce((acc, item) => acc + itemSubtotal(item), 0);
}

export function validateOrder(items: ItemPedido[]): string | null {
  return items.length === 0 ? EMPTY_ORDER_MESSAGE : null;
}

export interface DeduccionInventario {
  ingredientId: string;
  units: number;
}

export function inventoryDeductions(items: ItemPedido[]): DeduccionInventario[] {
  const unitsById = new Map<string, number>();
  for (const item of items) {
    for (const option of item.options) {
      unitsById.set(
        option.ingredientId,
        (unitsById.get(option.ingredientId) ?? 0) + item.quantity,
      );
    }
  }
  return [...unitsById.entries()].map(([ingredientId, units]) => ({
    ingredientId,
    units,
  }));
}

export function applyInventoryDeductions(
  ingredients: Pick<Ingrediente, "id" | "stock">[],
  deductions: DeduccionInventario[],
): Map<string, number> {
  const result = new Map(ingredients.map((ing) => [ing.id, ing.stock]));
  for (const deduction of deductions) {
    const current = result.get(deduction.ingredientId);
    if (current !== undefined) {
      result.set(deduction.ingredientId, current - deduction.units);
    }
  }
  return result;
}
