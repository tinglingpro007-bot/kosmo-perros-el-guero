import { NextResponse } from "next/server";

import { db } from "@/db";
import { createOrder, PedidoError } from "@/db/queries";
import type { PedidoInput } from "@/features/registrar-pedidos-con-opciones-seleccionadas/logic";

export async function POST(request: Request) {
  let body: { items?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const items = body?.items;
  if (!Array.isArray(items)) {
    return NextResponse.json(
      { error: "Bad Request", detail: "El cuerpo debe incluir una lista de productos." },
      { status: 400 },
    );
  }

  try {
    const order = createOrder(items as PedidoInput[], db);
    return NextResponse.json({ data: order }, { status: 201 });
  } catch (err) {
    if (err instanceof PedidoError) {
      return NextResponse.json(
        { error: "Unprocessable Entity", detail: err.message },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error", detail: "No se pudo registrar el pedido." },
      { status: 500 },
    );
  }
}
