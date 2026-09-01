// Database schema definitions using Drizzle ORM (SQLite)

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  basePrice: integer("base_price").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export const ingredients = sqliteTable("ingredients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  stock: integer("stock").notNull(),
  minLevel: integer("min_level").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("Confirmado"),
  total: integer("total").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export const orderItemOptions = sqliteTable("order_item_options", {
  id: text("id").primaryKey(),
  orderItemId: text("order_item_id")
    .notNull()
    .references(() => orderItems.id),
  ingredientId: text("ingredient_id")
    .notNull()
    .references(() => ingredients.id),
  ingredientName: text("ingredient_name").notNull(),
  price: integer("price").notNull(),
});

export type OrderItemOption = typeof orderItemOptions.$inferSelect;
export type NewOrderItemOption = typeof orderItemOptions.$inferInsert;
