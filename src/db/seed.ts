import type { Db } from "./client";
import * as schema from "./schema";

const seedProducts = [
  { id: "prd_sencillo", name: "Perro sencillo", basePrice: 3000 },
  { id: "prd_doble", name: "Perro doble", basePrice: 4000 },
  { id: "prd_especial", name: "Perro especial", basePrice: 5000 },
  { id: "prd_ranchero", name: "Perro ranchero", basePrice: 6000 },
] satisfies Omit<schema.NewProduct, "createdAt" | "active">[];

const seedIngredients = [
  { id: "ing_salchicha", name: "Salchicha", price: 0, stock: 10, minLevel: 10 },
  { id: "ing_queso", name: "Queso", price: 500, stock: 25, minLevel: 5 },
  { id: "ing_tocineta", name: "Tocineta", price: 700, stock: 18, minLevel: 5 },
  { id: "ing_papas", name: "Papas", price: 300, stock: 30, minLevel: 8 },
] satisfies Omit<schema.NewIngredient, "createdAt" | "active">[];

export function seedIfEmpty(db: Db): void {
  const existing = db.select().from(schema.products).all();
  if (existing.length > 0) return;
  db.insert(schema.products).values(seedProducts).run();
  db.insert(schema.ingredients).values(seedIngredients).run();
}
