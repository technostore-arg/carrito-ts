# Contexto — Ecosistema TechnoStore + Futuro Hard

## Visión
Un solo backend, dos marcas:

1. **TechnoStore** — tienda general de electrónica (celulares, notebooks, hardware consumo)
2. **Futuro Hard** — vertical IA (GPUs, RAM, SSD) + instalación de modelos locales. Marca visual propia, comparte catálogo, pedidos y admin.

## Reglas de negocio
- `tipo_venta: "directa" | "encargo"`
  - directa → checkout, descuenta stock, cobra (MercadoPago)
  - encargo → botón WhatsApp `wa.me/<n>?text=Hola, quiero consultar por [nombre] (SKU: [sku])`, registra `consulta_encargo` para métricas
- Ingesta:
  a) archivo (Excel/CSV/PDF) → IA normaliza → preview altas/bajas/precios → aprobación → aplica
  b) scraping externo → misma normalización → aprobación (Futuro Hard encargo)
- Admin único: catálogo (manual+IA), pedidos (directas + consultas WhatsApp), métricas (ventas, consultas, márgenes, comparación marcas)

## Diseño
Premium minimalista, microinteracciones, tipografía técnica, fotos grandes, alta performance, 100% responsive.
Objetivo: confianza, no plantilla genérica.

## Stack
- apps/technostore, apps/futurohard, apps/admin (Vite + React)
- packages/ui (componentes compartidos), packages/catalog-schema (tipos)
- server/ Express + SQLite (node:sqlite), MERCADOPAGO_ACCESS_TOKEN opcional
- Firebase/Firestore → Fase 7, hoy Express+SQLite

No generar código fuera de este contexto sin confirmar.
