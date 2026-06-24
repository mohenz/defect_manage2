# defect_manage2

DefectFlow defect management application converted to a local PostgreSQL and Node API runtime.

## Runtime

- Frontend: HTML, vanilla JavaScript, CSS
- Backend: Node.js API server
- Database: local PostgreSQL
- Default API URL: `http://127.0.0.1:3000/api`
- Default PostgreSQL: `127.0.0.1:54323`, database `defect_manage2`, user `postgres`

## Local Commands

```powershell
npm.cmd run check:syntax
npm.cmd run test:unit
.\scripts\start_local_db.ps1
.\scripts\stop_local_db.ps1
```

## Notes

- Browser code uses `StorageService` over `/api/*`; it does not call Supabase directly.
- Local database files, backups, logs, and `node_modules` are ignored by Git.
- Supabase migration support is provided by `scripts/migrate_supabase_to_local.ps1`.
