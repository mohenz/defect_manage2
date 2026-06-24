param(
  [switch]$Reset
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PgRoot = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
  Sort-Object { [int]$_.Name } -Descending |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $PgRoot) { throw "PostgreSQL was not found under C:\Program Files\PostgreSQL" }

$PgBin = Join-Path $PgRoot "bin"
$DataDir = Join-Path $ProjectRoot "local\postgres-data"
$LogPath = Join-Path $ProjectRoot "local\postgres.log"
$SchemaPath = Join-Path $ProjectRoot "local\schema.sql"
$MarkerPath = Join-Path $ProjectRoot "local\.schema_applied"
$ApiOutLog = Join-Path $ProjectRoot "local\api.out.log"
$ApiErrLog = Join-Path $ProjectRoot "local\api.err.log"
$Port = "54323"
$DbName = "defect_manage2"

New-Item -ItemType Directory -Force (Join-Path $ProjectRoot "local") | Out-Null

if ($Reset -and (Test-Path $DataDir)) {
  & (Join-Path $PgBin "pg_ctl.exe") -D $DataDir -m fast stop 2>$null
  Remove-Item -LiteralPath $DataDir -Recurse -Force
  Remove-Item -LiteralPath $MarkerPath -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path $DataDir)) {
  & (Join-Path $PgBin "initdb.exe") -D $DataDir -U postgres --auth=trust --encoding=UTF8 --locale=C
}

& (Join-Path $PgBin "pg_isready.exe") -h 127.0.0.1 -p $Port 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $PgBin "pg_ctl.exe") -D $DataDir -o "-p $Port" -l $LogPath start
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL start failed. Check $LogPath" }
}

$env:PGHOST = "127.0.0.1"
$env:PGPORT = $Port
$env:PGUSER = "postgres"
$env:PGDATABASE = "postgres"

$dbExists = & (Join-Path $PgBin "psql.exe") -tAc "select 1 from pg_database where datname='$DbName';"
if ($LASTEXITCODE -ne 0) { throw "PostgreSQL connection check failed." }
if (-not ($dbExists -match "1")) {
  & (Join-Path $PgBin "createdb.exe") $DbName
  if ($LASTEXITCODE -ne 0) { throw "Local database creation failed." }
}

if (-not (Test-Path $MarkerPath)) {
  & (Join-Path $PgBin "psql.exe") -d $DbName -f $SchemaPath
  if ($LASTEXITCODE -ne 0) { throw "Local schema apply failed." }
  Set-Content -Encoding UTF8 $MarkerPath (Get-Date -Format o)
}

$apiRunning = $false
try {
  $health = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:3000/api/health" -TimeoutSec 3
  if ($health.StatusCode -eq 200 -and $health.Content -like "*defect_manage2*") {
    $apiRunning = $true
  }
} catch {
  $apiRunning = $false
}

if (-not $apiRunning) {
  $env:PGHOST = "127.0.0.1"
  $env:PGPORT = $Port
  $env:PGUSER = "postgres"
  $env:PGDATABASE = $DbName
  Start-Process -FilePath "node" -ArgumentList @("server.js") -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput $ApiOutLog -RedirectStandardError $ApiErrLog
}

Write-Host "DefectFlow local DB/API is running."
Write-Host "API: http://127.0.0.1:3000"
Write-Host "PostgreSQL: 127.0.0.1:$Port / db=$DbName / user=postgres / auth=trust"
