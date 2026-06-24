$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PgRoot = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
  Sort-Object { [int]$_.Name } -Descending |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $PgRoot) { throw "PostgreSQL was not found under C:\Program Files\PostgreSQL" }

$PgBin = Join-Path $PgRoot "bin"
$DataDir = Join-Path $ProjectRoot "local\postgres-data"

$apiConnection = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($apiConnection) {
  Stop-Process -Id $apiConnection.OwningProcess -Force
}

if (Test-Path $DataDir) {
  & (Join-Path $PgBin "pg_ctl.exe") -D $DataDir -m fast stop
}

Write-Host "DefectFlow local DB/API stopped."
