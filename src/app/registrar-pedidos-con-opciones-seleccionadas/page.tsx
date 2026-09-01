import { db } from "@/db";
import { getCatalog, listConfirmedOrders } from "@/db/queries";
import { PageHeader } from "@/components/ui/page-header";
import { NuevoPedidoView } from "@/features/registrar-pedidos-con-opciones-seleccionadas";

export const dynamic = "force-dynamic";

export default function RegistrarPedidosPage() {
  const { productos, ingredientes } = getCatalog(db);
  const pedidos = listConfirmedOrders(db);

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        title="Registrar pedidos"
        description="Selecciona los perros calientes solicitados, define las cantidades y opciones de ingredientes, y confirma el pedido para que quede listo para preparación."
      />
      <NuevoPedidoView
        productos={productos}
        ingredientes={ingredientes}
        pedidosIniciales={pedidos}
      />
    </div>
  );
}
