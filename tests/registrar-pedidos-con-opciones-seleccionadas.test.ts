import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { openDatabase } from "@/db/client";
import type { Db } from "@/db/client";
import { createOrder, listConfirmedOrders, PedidoError } from "@/db/queries";
import * as schema from "@/db/schema";
import {
  applyInventoryDeductions,
  buildItem,
  computeTotal,
  computeUnitPrice,
  EMPTY_ORDER_MESSAGE,
  ingredientAvailable,
  inventoryDeductions,
  validateOrder,
} from "@/features/registrar-pedidos-con-opciones-seleccionadas/logic";
import type {
  Ingrediente,
  OpcionSeleccionada,
  Producto,
} from "@/features/registrar-pedidos-con-opciones-seleccionadas/logic";

function unProducto(overrides: Partial<Producto> = {}): Producto {
  return {
    id: "prd_sencillo",
    name: "Perro sencillo",
    basePrice: 3000,
    ...overrides,
  };
}

function opcionDe(ingrediente: Ingrediente): OpcionSeleccionada {
  return {
    ingredientId: ingrediente.id,
    name: ingrediente.name,
    price: ingrediente.price,
  };
}

function unIngrediente(overrides: Partial<Ingrediente> = {}): Ingrediente {
  return {
    id: "ing_queso",
    name: "Queso",
    price: 500,
    stock: 25,
    minLevel: 5,
    ...overrides,
  };
}

describe("Registrar pedidos — lógica pura", () => {
  describe("computeUnitPrice (REQ-1.7)", () => {
    it("suma el costo de los ingredientes adicionales al precio base", () => {
      // Arrange
      const queso = unIngrediente({ price: 500 });

      // Act
      const precio = computeUnitPrice(3000, [queso]);

      // Assert
      expect(precio).toBe(3500);
    });

    it("mantiene el precio base cuando no hay ingredientes adicionales", () => {
      // Arrange & Act
      const precio = computeUnitPrice(3000, []);

      // Assert
      expect(precio).toBe(3000);
    });
  });

  describe("buildItem (REQ-1.1)", () => {
    it("agrega el producto con su cantidad y opciones seleccionadas", () => {
      // Arrange
      const queso = unIngrediente();

      // Act
      const item = buildItem(unProducto(), 2, [opcionDe(queso)]);

      // Assert
      expect(item.productId).toBe("prd_sencillo");
      expect(item.quantity).toBe(2);
      expect(item.options).toHaveLength(1);
      expect(item.options[0].name).toBe("Queso");
      expect(item.unitPrice).toBe(3500);
    });
  });

  describe("computeTotal (REQ-1.3)", () => {
    it.each([
      [
        "un perro sencillo con queso y cantidad 2",
        [buildItem(unProducto(), 2, [opcionDe(unIngrediente())])],
        7000,
      ],
      [
        "un sencillo y dos especiales",
        [
          buildItem(unProducto(), 1, []),
          buildItem(
            unProducto({ id: "prd_especial", name: "Perro especial", basePrice: 5000 }),
            2,
            [],
          ),
        ],
        13000,
      ],
    ])("calcula el total para %s", (_name, items, esperado) => {
      // Arrange & Act
      const total = computeTotal(items);

      // Assert
      expect(total).toBe(esperado);
    });

    it("devuelve cero para un pedido sin productos", () => {
      // Arrange & Act
      const total = computeTotal([]);

      // Assert
      expect(total).toBe(0);
    });
  });

  describe("validateOrder (REQ-1.2)", () => {
    it("rechaza un pedido sin productos con el mensaje exacto", () => {
      // Arrange & Act
      const mensaje = validateOrder([]);

      // Assert
      expect(mensaje).toBe(EMPTY_ORDER_MESSAGE);
      expect(mensaje).toBe("Debe agregar al menos un producto al pedido");
    });

    it("acepta un pedido con al menos un producto", () => {
      // Arrange
      const items = [buildItem(unProducto(), 1, [])];

      // Act
      const mensaje = validateOrder(items);

      // Assert
      expect(mensaje).toBeNull();
    });
  });

  describe("ingredientAvailable (REQ-1.4)", () => {
    it.each([
      [{ stock: 10, minLevel: 10 }, false],
      [{ stock: 9, minLevel: 10 }, false],
      [{ stock: 11, minLevel: 10 }, true],
    ])("disponibilidad con %j es %s", (niveles, disponible) => {
      // Arrange & Act
      const resultado = ingredientAvailable(niveles);

      // Assert
      expect(resultado).toBe(disponible);
    });
  });

  describe("inventoryDeductions (REQ-1.6)", () => {
    it("descarta 2 unidades de salchicha con dos productos que la usan", () => {
      // Arrange
      const salchicha = unIngrediente({
        id: "ing_salchicha",
        name: "Salchicha",
        price: 0,
      });
      const items = [
        buildItem(unProducto(), 1, [opcionDe(salchicha)]),
        buildItem(unProducto(), 1, [opcionDe(salchicha)]),
      ];

      // Act
      const deducciones = inventoryDeductions(items);

      // Assert
      expect(deducciones).toEqual([{ ingredientId: "ing_salchicha", units: 2 }]);
    });

    it("multiplica por la cantidad de cada producto", () => {
      // Arrange
      const salchicha = unIngrediente({ id: "ing_salchicha", name: "Salchicha", price: 0 });

      // Act
      const deducciones = inventoryDeductions([
        buildItem(unProducto(), 3, [opcionDe(salchicha)]),
      ]);

      // Assert
      expect(deducciones).toEqual([{ ingredientId: "ing_salchicha", units: 3 }]);
    });
  });

  describe("applyInventoryDeductions (REQ-1.6)", () => {
    it("descuenta el inventario de salchicha de 10 a 8", () => {
      // Arrange
      const salchicha = { id: "ing_salchicha", stock: 10 };

      // Act
      const resultado = applyInventoryDeductions(
        [salchicha],
        [{ ingredientId: "ing_salchicha", units: 2 }],
      );

      // Assert
      expect(resultado.get("ing_salchicha")).toBe(8);
    });
  });
});

describe("Registrar pedidos — persistencia", () => {
  let testDb: Db;

  beforeAll(() => {
    testDb = openDatabase(":memory:");
  });

  describe("createOrder", () => {
    it("registra el pedido como Confirmado, guarda opciones y descuenta inventario", () => {
      // Arrange
      const stockAntes = testDb
        .select()
        .from(schema.ingredients)
        .where(eq(schema.ingredients.id, "ing_queso"))
        .get()!.stock;

      // Act
      const pedido = createOrder(
        [{ productId: "prd_sencillo", quantity: 2, ingredientIds: ["ing_queso"] }],
        testDb,
      );

      // Assert
      expect(pedido.status).toBe("Confirmado");
      expect(pedido.total).toBe(7000);
      expect(pedido.items).toHaveLength(1);
      expect(pedido.items[0].productName).toBe("Perro sencillo");
      expect(pedido.items[0].quantity).toBe(2);
      expect(pedido.items[0].options[0].ingredientName).toBe("Queso");

      const stockDespues = testDb
        .select()
        .from(schema.ingredients)
        .where(eq(schema.ingredients.id, "ing_queso"))
        .get()!.stock;
      expect(stockDespues).toBe(stockAntes - 2);
    });

    it("deja el pedido confirmado disponible para el cocinero", () => {
      // Arrange
      createOrder(
        [
          {
            productId: "prd_especial",
            quantity: 1,
            ingredientIds: ["ing_tocineta"],
          },
        ],
        testDb,
      );

      // Act
      const pedidos = listConfirmedOrders(testDb);

      // Assert
      const especial = pedidos.find((pedido) =>
        pedido.items.some((item) => item.productName === "Perro especial"),
      );
      expect(especial).toBeDefined();
      expect(especial!.items[0].options[0].ingredientName).toBe("Tocineta");
    });

    it("rechaza un pedido sin productos", () => {
      // Arrange & Act & Assert
      expect(() => createOrder([], testDb)).toThrowError(
        new PedidoError(EMPTY_ORDER_MESSAGE),
      );
    });

    it("rechaza un ingrediente agotado y no modifica el inventario", () => {
      // Arrange
      const stockAntes = testDb
        .select()
        .from(schema.ingredients)
        .where(eq(schema.ingredients.id, "ing_salchicha"))
        .get()!.stock;

      // Act & Assert
      expect(() =>
        createOrder(
          [
            {
              productId: "prd_sencillo",
              quantity: 1,
              ingredientIds: ["ing_salchicha"],
            },
          ],
          testDb,
        ),
      ).toThrowError(/no está disponible/);

      const stockDespues = testDb
        .select()
        .from(schema.ingredients)
        .where(eq(schema.ingredients.id, "ing_salchicha"))
        .get()!.stock;
      expect(stockDespues).toBe(stockAntes);
    });

    it("rechaza una cantidad menor a 1", () => {
      // Arrange & Act & Assert
      expect(() =>
        createOrder(
          [{ productId: "prd_sencillo", quantity: 0, ingredientIds: [] }],
          testDb,
        ),
      ).toThrowError(/al menos 1/);
    });
  });
});