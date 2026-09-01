"use client";

import { useMemo, useState } from "react";
import { Clock, CookingPot, ShoppingBag, Trash2 } from "lucide-react";

import type { PedidoConfirmado } from "@/db/queries";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { BadgeStatus } from "@/components/ui/badge-status";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

import {
  buildItem,
  computeTotal,
  computeUnitPrice,
  ingredientAvailable,
  validateOrder,
} from "../logic";
import type {
  Ingrediente,
  ItemPedido,
  OpcionSeleccionada,
  Producto,
} from "../logic";

interface NuevoPedidoViewProps {
  productos: Producto[];
  ingredientes: Ingrediente[];
  pedidosIniciales: PedidoConfirmado[];
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString("es-CO")}`;
}

export function NuevoPedidoView({
  productos,
  ingredientes,
  pedidosIniciales,
}: NuevoPedidoViewProps) {
  const [items, setItems] = useState<ItemPedido[]>([]);
  const [pedidos, setPedidos] = useState<PedidoConfirmado[]>(pedidosIniciales);
  const [productoModal, setProductoModal] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [opciones, setOpciones] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const total = computeTotal(items);

  const opcionesSeleccionadas = useMemo<OpcionSeleccionada[]>(() => {
    return opciones
      .map((id) => ingredientes.find((ingrediente) => ingrediente.id === id))
      .filter((ingrediente): ingrediente is Ingrediente => Boolean(ingrediente))
      .map((ingrediente) => ({
        ingredientId: ingrediente.id,
        name: ingrediente.name,
        price: ingrediente.price,
      }));
  }, [opciones, ingredientes]);

  const precioUnitario = productoModal
    ? computeUnitPrice(productoModal.basePrice, opcionesSeleccionadas)
    : 0;

  function abrirModal(producto: Producto) {
    setProductoModal(producto);
    setCantidad(1);
    setOpciones([]);
    setError(null);
  }

  function toggleOpcion(id: string) {
    setOpciones((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function agregarAlPedido() {
    if (!productoModal) return;
    const nuevoItem = buildItem(productoModal, cantidad, opcionesSeleccionadas);
    setItems((prev) => [...prev, nuevoItem]);
    setProductoModal(null);
    setExito(null);
  }

  function quitarItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function confirmarPedido() {
    const mensaje = validateOrder(items);
    if (mensaje) {
      setError(mensaje);
      setExito(null);
      return;
    }
    setError(null);
    setExito(null);
    setConfirmando(true);
    try {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            ingredientIds: item.options.map((option) => option.ingredientId),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ?? "No se pudo confirmar el pedido.");
        return;
      }
      setPedidos((prev) => [json.data, ...prev]);
      setItems([]);
      setExito("Pedido confirmado y listo para preparación.");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className="d-flex flex-column gap-4">
      <div className="row g-3">
        <section className="col-lg-8">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h2 className="h5 fw-semibold text-dark mb-0">Menú de perros</h2>
            <Badge tone="primary" className="px-3 py-1">
              {productos.length} productos
            </Badge>
          </div>
          <div className="row g-3 row-cols-1 row-cols-md-2 row-cols-xl-3">
            {productos.map((producto) => (
              <div key={producto.id} className="col">
                <Card className="h-100 d-flex flex-column shadow-sm">
                  <CardHeader>
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="d-flex align-items-center justify-content-center rounded bg-primary-subtle text-primary"
                        style={{ width: "3rem", height: "3rem" }}
                      >
                        <CookingPot size={22} />
                      </div>
                      <div>
                        <CardTitle>{producto.name}</CardTitle>
                        <Badge tone="primary">{formatMoney(producto.basePrice)}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody className="mt-auto pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-100"
                      onClick={() => abrirModal(producto)}
                    >
                      Agregar al pedido
                    </Button>
                  </CardBody>
                </Card>
              </div>
            ))}
          </div>
        </section>

        <section className="col-lg-4">
          <Card className="shadow-sm h-100">
            <CardHeader>
              <CardTitle className="d-flex align-items-center gap-2">
                <ShoppingBag size={18} className="text-primary" />
                Pedido actual
              </CardTitle>
            </CardHeader>
            <CardBody>
              {error ? (
                <Alert variant="danger" className="mb-3">
                  {error}
                </Alert>
              ) : null}
              {exito ? (
                <Alert variant="success" className="mb-3">
                  {exito}
                </Alert>
              ) : null}
              {items.length === 0 ? (
                <EmptyState
                  title="Aún no hay productos"
                  description="Selecciona un perro del menú para agregarlo al pedido."
                  className="py-4"
                />
              ) : (
                <ul className="list-unstyled d-flex flex-column gap-3 mb-0">
                  {items.map((item) => (
                    <li key={item.id} className="d-flex gap-2 align-items-start">
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-center gap-2">
                          <span className="fw-semibold text-dark">
                            {item.productName}{" "}
                            <span className="text-secondary fw-normal">
                              × {item.quantity}
                            </span>
                          </span>
                          <span className="fw-semibold text-dark">
                            {formatMoney(item.unitPrice * item.quantity)}
                          </span>
                        </div>
                        <div className="d-flex align-items-center gap-2 flex-wrap mt-1">
                          {item.options.length === 0 ? (
                            <small className="text-muted">Sin extras</small>
                          ) : (
                            item.options.map((option) => (
                              <Badge key={option.ingredientId} tone="info">
                                +{option.name} {formatMoney(option.price)}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Quitar ${item.productName}`}
                        onClick={() => quitarItem(item.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
            <CardFooter>
              <div className="d-flex justify-content-between align-items-center py-2">
                <span className="text-secondary fw-semibold">Total a pagar</span>
                <span className="h5 fw-bold text-primary mb-0">
                  {formatMoney(total)}
                </span>
              </div>
              <Button
                variant="primary"
                className="w-100 mt-1"
                disabled={confirmando}
                onClick={confirmarPedido}
              >
                {confirmando ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm"
                      aria-hidden="true"
                    />
                    Confirmando...
                  </>
                ) : (
                  "Confirmar pedido"
                )}
              </Button>
            </CardFooter>
          </Card>
        </section>
      </div>

      <section>
        <div className="d-flex align-items-center gap-2 mb-3">
          <Clock size={18} className="text-primary" />
          <h2 className="h5 fw-semibold text-dark mb-0">
            Pedidos listos para preparar
          </h2>
        </div>
        {pedidos.length === 0 ? (
          <EmptyState
            title="No hay pedidos confirmados"
            description="Los pedidos que confirmes aparecerán aquí para que el cocinero los prepare."
          />
        ) : (
          <div className="row g-3 row-cols-1 row-cols-md-2 row-cols-xl-3">
            {pedidos.map((pedido) => (
              <div key={pedido.id} className="col">
                <Card className="h-100 shadow-sm">
                  <CardHeader>
                    <div className="d-flex justify-content-between align-items-center gap-2">
                      <span className="small text-muted">
                        {pedido.id.replace("ord_", "Pedido #")}
                      </span>
                      <BadgeStatus status="completed" label="Confirmado" />
                    </div>
                  </CardHeader>
                  <CardBody>
                    <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                      {pedido.items.map((item) => (
                        <li key={item.id}>
                          <div className="d-flex justify-content-between gap-2">
                            <span className="fw-semibold text-dark">
                              {item.productName}{" "}
                              <span className="text-secondary fw-normal">
                                × {item.quantity}
                              </span>
                            </span>
                            <span className="text-secondary small">
                              {formatMoney(item.unitPrice * item.quantity)}
                            </span>
                          </div>
                          {item.options.length > 0 ? (
                            <div className="d-flex gap-2 flex-wrap mt-1">
                              {item.options.map((option) => (
                                <Badge key={option.ingredientId} tone="info">
                                  +{option.ingredientName}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                  <CardFooter>
                    <div className="d-flex justify-content-between align-items-center pt-2">
                      <span className="text-secondary small fw-semibold">
                        Total
                      </span>
                      <span className="fw-bold text-primary">
                        {formatMoney(pedido.total)}
                      </span>
                    </div>
                  </CardFooter>
                </Card>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        isOpen={productoModal !== null}
        onClose={() => setProductoModal(null)}
        title={productoModal?.name ?? ""}
        footer={
          <div className="d-flex gap-2 w-100 justify-content-end">
            <Button variant="light" onClick={() => setProductoModal(null)}>
              Cancelar
            </Button>
            <Button onClick={agregarAlPedido}>Agregar al pedido</Button>
          </div>
        }
      >
        {productoModal ? (
          <div className="d-flex flex-column gap-3">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <Label htmlFor="cantidad">Cantidad</Label>
                <Input
                  id="cantidad"
                  type="number"
                  min={1}
                  value={cantidad}
                  onChange={(e) =>
                    setCantidad(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-25"
                />
              </div>
              <div className="text-end">
                <span className="d-block small text-secondary">
                  Precio unitario
                </span>
                <span className="fs-5 fw-bold text-primary">
                  {formatMoney(precioUnitario)}
                </span>
              </div>
            </div>
            <div>
              <Label>Opciones de ingredientes</Label>
              <div className="d-flex flex-column gap-2">
                {ingredientes.map((ingrediente) => {
                  const disponible = ingredientAvailable(ingrediente);
                  const marcado = opciones.includes(ingrediente.id);
                  return (
                    <div
                      key={ingrediente.id}
                      className="d-flex align-items-center gap-2 form-check mb-0"
                    >
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={`opcion-${ingrediente.id}`}
                        checked={marcado}
                        disabled={!disponible}
                        onChange={() => toggleOpcion(ingrediente.id)}
                      />
                      <label
                        htmlFor={`opcion-${ingrediente.id}`}
                        className="form-check-label d-flex align-items-center gap-2 flex-grow-1"
                      >
                        <span>{ingrediente.name}</span>
                        <Badge tone="neutral">
                          +{formatMoney(ingrediente.price)}
                        </Badge>
                        {!disponible ? (
                          <Badge tone="danger">No disponible</Badge>
                        ) : null}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
