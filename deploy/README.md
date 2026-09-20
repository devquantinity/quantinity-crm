# deploy/

`env.example` is the annotated environment for a production install. Copy it to
`.env` beside your compose file and fill it in.

There is deliberately no `docker-compose.yml` here. Take the current one from
Twenty's repository for the version in `TAG`, because it changes between
releases and a stale copy is worse than a link:

https://github.com/twentyhq/twenty/blob/main/packages/twenty-docker/docker-compose.yml

The full deployment guide, including what is not solved yet, is
[../DEPLOYMENT.md](../DEPLOYMENT.md).
