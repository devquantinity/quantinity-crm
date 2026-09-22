# deploy/

| File | What |
|---|---|
| `env.example` | Annotated production environment. Copy to `.env`, fill in |
| `docker-compose.override.yml` | Fixes to Twenty's stock compose, plus the Caddy service |
| `Caddyfile` | Wildcard TLS and the `crm.quantinity.com/<slug>` redirect |
| `caddy/Dockerfile` | Caddy built with the Cloudflare DNS module |

There is deliberately no `docker-compose.yml` here. Take the one for the
version in `TAG` from Twenty's repository, because it changes between releases
and a stale copy is worse than a link:

https://raw.githubusercontent.com/twentyhq/twenty/v2.40.0/packages/twenty-docker/docker-compose.yml

On the server:

```
/opt/quantinity/
  docker-compose.yml            <- Twenty's, for TAG
  docker-compose.override.yml   <- this folder
  Caddyfile                     <- this folder
  caddy/Dockerfile              <- this folder
  .env                          <- from env.example, never committed
```

then `docker compose up -d --build`. The override is not optional: without it
most of `.env` never reaches the containers and port 3000 is open to the
internet.

The full guide is [../DEPLOYMENT.md](../DEPLOYMENT.md).
