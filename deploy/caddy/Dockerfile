# Caddy with the Cloudflare DNS module, needed for the *.crm.quantinity.com
# wildcard certificate (DNS-01). Stock Caddy cannot do DNS challenges.
FROM caddy:2-builder AS build
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2
COPY --from=build /usr/bin/caddy /usr/bin/caddy
