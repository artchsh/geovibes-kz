# Trusted proxy boundary

GeoVibes ignores `X-Forwarded-For` and `X-Real-IP` by default. A directly
exposed backend therefore groups requests under the stable `unknown` network
identity instead of trusting client-controlled forwarding headers.

When the backend is placed behind a controlled reverse proxy:

1. Generate an internal `TRUSTED_PROXY_SECRET` of at least 32 random characters.
2. Configure the same secret at the proxy and backend.
3. Make the proxy remove any incoming `X-GeoVibes-Proxy-Secret` header, then add
   its own secret plus the canonical forwarding IP header.
4. Keep this internal header off public logs and never expose the secret to
   browsers or mobile clients.

The backend accepts forwarded IP data only when the companion secret matches
using a timing-safe comparison. Do not configure the secret if the proxy cannot
strip client-supplied copies of the companion header.
