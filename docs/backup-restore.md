# Backup and restore

The named Compose volume provides restart persistence, not a backup. Before valuable research data is entered, define an encrypted off-machine backup location and retention policy.

For a controlled local export:

```text
docker compose exec -T db pg_dump -U biodry -d biodry -Fc > biodry.dump
```

For restore, stop application writes, create an empty target database with the same application version, then run:

```text
docker compose exec -T db pg_restore -U biodry -d biodry --clean --if-exists < biodry.dump
```

Treat dump files as sensitive research data. Store them outside the repository, restrict access, encrypt them, and test restoration on a disposable environment. Confirm custom database/user names from `.env` before running either command. Do not use volume deletion as a backup or migration method.
