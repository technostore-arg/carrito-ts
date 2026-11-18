# Scheduling de crons (plan Hobby)

Los endpoints están protegidos con `Authorization: Bearer ${CRON_SECRET}`.

## Elit — stock y precios (cada 15 min)

- URL: `https://carrito-ts-neon.vercel.app/api/cron/elit-sync`
- Método: `POST`
- Header: `Authorization: Bearer <CRON_SECRET>`
- Header: `Content-Type: application/json`
- Body: `{"mode":"stock"}`

## Elit — catálogo completo (diario)

- Misma URL y headers
- Body: `{"mode":"catalog"}`

## En cron-job.org

1. Crear cuenta gratis en https://www.cron-job.org
2. **Create job**
3. Pegar la URL, elegir `POST`
4. En **Advanced → HTTP headers** agregar:
   - `Authorization: Bearer <CRON_SECRET>`
   - `Content-Type: application/json`
5. En **Request body** pegar `{"mode":"stock"}` (o `catalog`)
6. Schedule: **Every 15 minutes** (stock) / **Daily** (catálogo)
7. Guardar y activar.

## Copiar el secreto localmente

```powershell
((Get-Content .env.local | Where-Object { $_ -match '^CRON_SECRET=' }) -replace '^CRON_SECRET=','') | Set-Clipboard
```

> Hoy `ELIT_MODE=sandbox`, así que estos crons sincronizan los fixtures de prueba. Para datos reales hay que cargar `ELIT_USER_ID` + `ELIT_TOKEN` y cambiar `ELIT_MODE=production`.
