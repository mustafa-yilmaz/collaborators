# Collaborators in production

One server (Hetzner Cloud **CX33**: 4 vCPU, 8 GB, Ubuntu 24.04) runs
everything with Docker Compose: Caddy (HTTPS) → the frontend's nginx router →
the backend, its worker, the collaboration server, the converters and the
files (MinIO); Keycloak for signing in; one PostgreSQL for the app, the
collaboration server and Keycloak.

| Address | What |
|---|---|
| `https://collaborators.community` | the app |
| `https://<workspace>.collaborators.community` | a workspace's wikis |
| `https://auth.collaborators.community` | signing in (Keycloak) |
| a wiki's own domain | that wiki (CNAME to `wikis.collaborators.community`) |

Certificates are Let's Encrypt's, made by Caddy as addresses are first
visited, once the backend vouches for them (`/api/v1.0/tls-allowed/`).

## DNS (at the domain's registrar)

| Type | Host | Value |
|---|---|---|
| A | `@` | the server's IPv4 |
| A | `www` | the server's IPv4 |
| A | `auth` | the server's IPv4 |
| A | `*` | the server's IPv4 (workspace addresses, `wikis`) |

## First install

From this repository, on your computer (`<ip>`: the server's IPv4; the deploy
key is `~/.ssh/collaborators_hetzner`):

1. `deploy/production/bin/deploy.sh <ip> --prepare`
   installs Docker, the firewall, a swap file, security updates and the nightly
   backup, then copies the code. It stops, asking for step 2.
2. On the server (`ssh -i ~/.ssh/collaborators_hetzner root@<ip>`):
   `cd /opt/collaborators/deploy/production && bin/init.sh collaborators.community <your email>`
   makes the secrets, keys and Keycloak realm (`env/`, `keys/`, never copied off).
3. Still there, fill in:
   - `env/app.env`: the `<…>` email (SMTP) values of your email service;
   - `env/sso.env`: the Google, Microsoft and LinkedIn client ids and secrets
     (the same apps as in development, with the production redirect address
     added at each: `https://auth.collaborators.community/realms/collaborators/broker/<google|microsoft|linkedin>/endpoint`).
4. Back on your computer: `deploy/production/bin/deploy.sh <ip>` builds the
   images on the server, creates the databases' schemas and starts everything.
5. On the server: `bin/setup-keycloak.sh` sets up the providers, emails and
   account linking (the same script as in development).

## Releases

`deploy/production/bin/deploy.sh <ip>` — copies the code, rebuilds, migrates,
restarts what changed. The secrets, keys and data stay on the server.

## Backups

Every night at 03:15, `bin/backup.sh` writes the databases, the files and the
secrets to `data/backups/<date>/` and keeps 14 days. They're on the same disk:
turn on the server's **Backups** at Hetzner (about 20% of its price) so a copy
lives elsewhere.

To restore the databases: `gunzip -c data/backups/<date>/databases.sql.gz |
docker compose exec -T postgresql psql -U collaborators -d postgres`.

## Memory

Each service has a cap (`mem_limit`), so one spike can't stop the others;
about 6 GB in all, with a 4 GB swap file as a cushion. `docker stats` shows
what each uses. If it gets tight, Hetzner resizes the server in minutes
(keeping the disk lets it go back down).

## Everyday commands (on the server, in `/opt/collaborators/deploy/production`)

- `docker compose ps` — what runs
- `docker compose logs -f backend` — a service's logs
- `docker compose restart backend` — restart one
- `docker compose exec backend python manage.py createsuperuser` — an admin
  of Django's admin site (`/admin`)
