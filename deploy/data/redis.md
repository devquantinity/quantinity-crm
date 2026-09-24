# Redis - on the API VM

Holds the background-job queues and the engine's cache. It is small and only
the API and worker on the same machine talk to it, so it lives on the API VM,
listening on localhost only. No port to open, no firewall rule, no network
hop. (The engine's own compose file runs it beside the server the same way.)

```bash
apt install -y redis-server
```

```
# /etc/redis/redis.conf - change only these
bind 127.0.0.1 -::1                  # Ubuntu's default: this machine only
requirepass CHANGEME                 # optional on localhost, cheap insurance
maxmemory 768mb                      # leave the API and worker room
maxmemory-policy noeviction          # NOT optional - see below
appendonly yes                       # queued jobs survive a restart
```

```bash
echo 'vm.overcommit_memory = 1' >> /etc/sysctl.conf && sysctl vm.overcommit_memory=1
systemctl restart redis-server
redis-cli -a '<password>' ping                         # PONG
```

`REDIS_URL=redis://:CHANGEME@127.0.0.1:6379` in `/etc/quantinity/api.env`
(`redis://127.0.0.1:6379` if you left `requirepass` off).

**`noeviction` is the one setting that matters.** Redis's usual policies evict
keys when memory runs out, and a queued job is a key. Under pressure, jobs
would vanish without an error anywhere. With `noeviction`, Redis refuses new
writes instead, which is loud and fixable.

Never bind it to a public address. Port 6379 stays closed in ufw.
