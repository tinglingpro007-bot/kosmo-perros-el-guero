import { ShoppingCart } from "lucide-react";

import type { FeatureManifest } from "@/features/types";

export const registrarPedidosManifest: FeatureManifest = {
  slug: "registrar-pedidos-con-opciones-seleccionadas",
  title: "Registrar pedidos",
  description:
    "Registra los perros calientes solicitados con sus cantidades y opciones de ingredientes, y confirma el pedido para su preparación.",
  route: "/registrar-pedidos-con-opciones-seleccionadas",
  icon: ShoppingCart,
};
