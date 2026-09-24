# Postgres VM

Every customer is in this one database. Treat this VM as the business.

Ubuntu 24.04, Postgres 16 (what the engine's own compose file runs). 2 vCPU /
4 GB to start; watch it before anything else when things get slow.

## Install

```bash
apt install -y postgresql            # includes contrib (unaccent, citext, uuid-ossp)
```

## Database and role

The engine creates its own schemas and extensions on first start, as the
database owner. It never needs the `postgres` superuser, so do not give it
one. Creating the extensions here as well means a first start does not depend
on the owner being allowed to:

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE twenty LOGIN PASSWORD 'CHANGEME';
CREATE DATABASE twenty OWNER twenty;
\c twenty
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "citext";
SQL
```

`PG_DATABASE_URL=postgres://twenty:CHANGEME@<private-ip>:5432/twenty` in
`/etc/quantinity/api.env`.

## Network

Listen on the private interface only, and accept only the API VM:

```
# /etc/postgresql/16/main/postgresql.conf
listen_addresses = 'localhost,<postgres-vm-ip>'   # a real address on this VM (ip -4 addr show)

# /etc/postgresql/16/main/pg_hba.conf
host  twenty  twenty  <api-vm-ip>/32  scram-sha-256   # the API VM
```

```bash
ufw allow from <api-vm-ip> to any port 5432 proto tcp
systemctl restart postgresql
```

Port 5432 is open to the API VM's IP only, never to the whole internet.

## Backups

DEPLOYMENT.md section 5. Nightly `pg_dump` from this VM, copied off it, and
restored somewhere else on a schedule. A dump nobody has restored is not a
backup.
