import { desc, eq, inArray } from "drizzle-orm";

import {
  buildItem,
  computeTotal,
  ingredientAvailable,
  inventoryDeductions,
  validateOrder,
} from "@/features/registrar-pedidos-con-opciones-seleccionadas/logic";
import type { ItemPedido, PedidoInput } from "@/features/registrar-pedidos-con-opciones-seleccionadas/logic";

import type { Db } from "./client";
import * as schema from "./schema";

export class PedidoError extends Error {}

export interface PedidoItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  options: { ingredientId: string; ingredientName: string; price: number }[];
}

export interface PedidoConfirmado {
  id: string;
  status: string;
  total: number;
  createdAt: Date;
  items: PedidoItem[];
}

export function getCatalog(db: Db) {
  const productos = db
    .select()
    .from(schema.products)
    .where(eq(schema.products.active, true))
    .all();
  const ingredientes = db
    .select()
    .from(schema.ingredients)
    .where(eq(schema.ingredients.active, true))
    .all();
  return { productos, ingredientes };
}

export function createOrder(input: PedidoInput[], db: Db): PedidoConfirmado {
  if (input.length === 0) {
    throw new PedidoError(validateOrder([]) ?? "");
  }

  const productIds = [...new Set(input.map((row) => row.productId))];
  const products = db
    .select()
    .from(schema.products)
    .where(inArray(schema.products.id, productIds))
    .all();
  const productMap = new Map(products.map((product) => [product.id, product]));

  const ingredientIds = [...new Set(input.flatMap((row) => row.ingredientIds))];
  const allIngredients =
    ingredientIds.length > 0
      ? db
          .select()
          .from(schema.ingredients)
          .where(inArray(schema.ingredients.id, ingredientIds))
          .all()
      : [];
  const ingredientMap = new Map(
    allIngredients.map((ingrediente) => [ingrediente.id, ingrediente]),
  );

  const items: ItemPedido[] = input.map((row) => {
    const product = productMap.get(row.productId);
    if (!product) {
      throw new PedidoError("El producto seleccionado no existe");
    }
    if (row.quantity < 1) {
      throw new PedidoError("La cantidad de cada producto debe ser al menos 1");
    }
    const options = row.ingredientIds.map((ingredientId) => {
      const ingrediente = ingredientMap.get(ingredientId);
      if (!ingrediente) {
        throw new PedidoError("El ingrediente seleccionado no existe");
      }
      if (!ingredientAvailable(ingrediente)) {
        throw new PedidoError(
          `El ingrediente '${ingrediente.name}' no está disponible`,
        );
      }
      return {
        ingredientId: ingrediente.id,
        name: ingrediente.name,
        price: ingrediente.price,
      };
    });
    return buildItem(product, row.quantity, options);
  });

  const total = computeTotal(items);
  const deductions = inventoryDeductions(items);
  const orderId = `ord_${crypto.randomUUID()}`;

  db.transaction((tx) => {
    for (const deduction of deductions) {
      const current = ingredientMap.get(deduction.ingredientId)?.stock ?? 0;
      tx.update(schema.ingredients)
        .set({ stock: current - deduction.units })
        .where(eq(schema.ingredients.id, deduction.ingredientId))
        .run();
    }
    tx.insert(schema.orders)
      .values({ id: orderId, status: "Confirmado", total })
      .run();
    for (const item of items) {
      tx.insert(schema.orderItems)
        .values({
          id: item.id,
          orderId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })
        .run();
      for (const option of item.options) {
        tx.insert(schema.orderItemOptions)
          .values({
            id: `opt_${crypto.randomUUID()}`,
            orderItemId: item.id,
            ingredientId: option.ingredientId,
            ingredientName: option.name,
            price: option.price,
          })
          .run();
      }
    }
  });

  return {
    id: orderId,
    status: "Confirmado",
    total,
    createdAt: new Date(),
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      options: item.options.map((option) => ({
        ingredientId: option.ingredientId,
        ingredientName: option.name,
        price: option.price,
      })),
    })),
  };
}

export function listConfirmedOrders(db: Db): PedidoConfirmado[] {
  const orders = db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.status, "Confirmado"))
    .orderBy(desc(schema.orders.createdAt))
    .all();
  if (orders.length === 0) return [];

  const orderIds = orders.map((order) => order.id);
  const items = db
    .select()
    .from(schema.orderItems)
    .where(inArray(schema.orderItems.orderId, orderIds))
    .all();
  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  const options =
    items.length > 0
      ? db
          .select()
          .from(schema.orderItemOptions)
          .where(
            inArray(
              schema.orderItemOptions.orderItemId,
              items.map((item) => item.id),
            ),
          )
          .all()
      : [];
  const optionsByItem = new Map<string, typeof options>();
  for (const option of options) {
    const list = optionsByItem.get(option.orderItemId) ?? [];
    list.push(option);
    optionsByItem.set(option.orderItemId, list);
  }

  return orders.map((order) => ({
    id: order.id,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt,
    items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      options: (optionsByItem.get(item.id) ?? []).map((option) => ({
        ingredientId: option.ingredientId,
        ingredientName: option.ingredientName,
        price: option.price,
      })),
    })),
  }));
}
