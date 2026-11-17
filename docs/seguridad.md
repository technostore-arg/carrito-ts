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

## 2FA del admin (nuevo)

```bash
node scripts/admin-2fa-setup.mjs
```

Imprime el secreto Base32 y el URI `otpauth://`. Guardá el secreto en `ADMIN_TOTP_SECRET` (Vercel + `.env`) y hacé redeploy. Escaneá el URI con Google Authenticator / 1Password / Aegis. Desde entonces el login exige contraseña **+** código de 6 dígitos. Si la variable no está configurada, el login sigue funcionando sólo con contraseña (campo 2FA opcional en el UI).

Sesiones admin: expiran a las 8 h (`ADMIN_SESSION_TTL_MS`). Se quitó el log que mostraba la contraseña al iniciar el servidor.

## Variables nuevas

```
ML_SELLER_ID=
WHATSAPP_APP_SECRET=
DAILY_AUTO_SPEND_CAP_USD=400
ADMIN_TOTP_SECRET=
ADMIN_SESSION_TTL_MS=28800000
```

## Suite

```bash
npm run test:security && npm run test:cro && npm run test:pricing && npm run test:ml && npm run test:agent && npm run test:e2e && npm run build
```
