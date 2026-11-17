# Seguridad / hardening (AppSec)

## Cambios aplicados

- `server/hub/security.js`: `safeCompareSecret` (timingSafeEqual), rate limiter deslizante, OAuth state HMAC, firma HMAC de WhatsApp y validación de seller de ML.
- `/api/cron/*`: usan `safeCompareSecret` para `CRON_SECRET`.
- `/api/ml/auth/url`: exige `?admin_key=${CRON_SECRET}` o `Authorization: Bearer ${CRON_SECRET}`; genera `state` firmado (10 min). `/api/ml/auth/callback` lo valida antes del canje.
- `/api/agent/chat` y `/api/orders`: rate limit 15 req/min/IP; el chat limita el mensaje a 500 chars y refuerza el prompt contra prompt injection.
- `/api/ml/webhooks`: si `ML_SELLER_ID` está configurado, rechaza (401) eventos con `user_id` distinto. El procesador `orders_v2` toma datos **sólo** de `mlClient.getOrder()`.
- `/api/agent/whatsapp`: valida `X-Hub-Signature-256` cuando `WHATSAPP_APP_SECRET` está configurado (body crudo capturado en `express.json.verify`).
- Aprobaciones: tokens HMAC con expiración de 24 hs (formato legacy aún válido) y tope diario `DAILY_AUTO_SPEND_CAP_USD=400` acumulado en 24 hs.
- `vercel.json`: `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy` globales (no rompen CORS).

## Variables nuevas

```
ML_SELLER_ID=
WHATSAPP_APP_SECRET=
DAILY_AUTO_SPEND_CAP_USD=400
```

## Suite

```bash
npm run test:security && npm run test:cro && npm run test:pricing && npm run test:ml && npm run test:agent && npm run test:e2e && npm run build
```
