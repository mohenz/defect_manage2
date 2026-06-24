param(
  [string]$SupabaseUrl = "",
  [string]$SupabaseKey = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ConfigPath = Join-Path $ProjectRoot "js\config.js"
$BackupDir = Join-Path $ProjectRoot "local\backups"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupJsonPath = Join-Path $BackupDir "supabase_export_$Timestamp.json"
$ImportSqlPath = Join-Path $BackupDir "supabase_to_local_import_$Timestamp.sql"
$PgRoot = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
  Sort-Object { [int]$_.Name } -Descending |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $PgRoot) { throw "PostgreSQL was not found under C:\Program Files\PostgreSQL" }
$Psql = Join-Path $PgRoot "bin\psql.exe"

New-Item -ItemType Directory -Force $BackupDir | Out-Null

if ((-not $SupabaseUrl -or -not $SupabaseKey) -and (Test-Path $ConfigPath)) {
  $config = Get-Content $ConfigPath -Raw
  if (-not $SupabaseUrl) {
    $SupabaseUrl = [regex]::Match($config, 'SUPABASE_URL:\s*"([^"]+)"').Groups[1].Value
  }
  if (-not $SupabaseKey) {
    $SupabaseKey = [regex]::Match($config, 'SUPABASE_KEY:\s*"([^"]+)"').Groups[1].Value
  }
}

if (-not $SupabaseUrl) { $SupabaseUrl = "https://plytprvkgqtujbhkfnan.supabase.co" }
if (-not $SupabaseKey) { $SupabaseKey = "sb_publishable_iX0FkbedYyOqEAMfaM2OTw_joVbatc3" }
$SupabaseUrl = $SupabaseUrl.TrimEnd("/")

function Get-SupabaseTable {
  param([string]$Table)
  $headers = @{
    apikey = $SupabaseKey
    Authorization = "Bearer $SupabaseKey"
  }
  $allRows = @()
  $offset = 0
  $pageSize = 100
  while ($true) {
    try {
      $rows = Invoke-RestMethod -Method Get -Uri "$SupabaseUrl/rest/v1/$Table`?select=*&limit=$pageSize&offset=$offset" -Headers $headers
    } catch {
      throw "Failed to export table '$Table'. Check REST permissions or provide a service role key. $($_.Exception.Message)"
    }
    $page = @($rows)
    if ($page.Count -eq 0) { break }
    $allRows += $page
    if ($page.Count -lt $pageSize) { break }
    $offset += $pageSize
  }
  return @($allRows)
}

function Get-SupabaseRows {
  param(
    [string]$Table,
    [string]$Query
  )
  $headers = @{
    apikey = $SupabaseKey
    Authorization = "Bearer $SupabaseKey"
  }
  try {
    return Invoke-RestMethod -Method Get -Uri "$SupabaseUrl/rest/v1/$Table`?$Query" -Headers $headers
  } catch {
    throw "Failed to export table '$Table' with query '$Query'. Check REST permissions or provide a service role key. $($_.Exception.Message)"
  }
}

function Encode-UrlValue {
  param([string]$Value)
  return [System.Uri]::EscapeDataString($Value)
}

function Normalize-Rows {
  param($Rows)
  $items = New-Object System.Collections.Generic.List[object]
  foreach ($item in @($Rows)) {
    if ($item -is [System.Array]) {
      foreach ($child in $item) {
        $items.Add($child) | Out-Null
      }
    } else {
      $items.Add($item) | Out-Null
    }
  }
  return $items.ToArray()
}

function Get-RecentDefectsByTestTypes {
  param($CommonCodes)
  $testTypes = @($CommonCodes |
    Where-Object { $_.group_code -eq "TEST_TYPE" } |
    Sort-Object sort_order, code_value |
    ForEach-Object { $_.code_value } |
    Where-Object { $_ })

  if ($testTypes.Count -eq 0) {
    $testTypes = @("선오픈", "통합테스트", "3자테스트(I&C)", "3자테스트(W2)", "단위테스트", "최종테스트")
  }

  $seen = @{}
  $rows = New-Object System.Collections.Generic.List[object]
  foreach ($testType in $testTypes) {
    $offset = 0
    $pageSize = 20
    $fetchedForType = 0
    $encodedType = Encode-UrlValue $testType
    while ($fetchedForType -lt 100) {
      $limit = [Math]::Min($pageSize, 100 - $fetchedForType)
      $query = "select=*&test_type=eq.$encodedType&order=created_at.desc&limit=$limit&offset=$offset"
      $page = @(Normalize-Rows (Get-SupabaseRows "defects" $query))
      if ($page.Count -eq 0) { break }
      foreach ($row in $page) {
        $key = [string]$row.defect_id
        if (-not $seen.ContainsKey($key)) {
          $seen[$key] = $true
          $rows.Add($row) | Out-Null
        }
      }
      $fetchedForType += $page.Count
      if ($page.Count -lt $limit) { break }
      $offset += $limit
    }
    Write-Host "defects[$testType]: $fetchedForType rows"
  }
  return $rows.ToArray()
}

function Sql-Scalar {
  param($Value, [string]$Cast = "")
  if ($null -eq $Value) { return "null" }
  if ($Value -is [bool]) {
    if ($Value) { return "true" }
    return "false"
  }
  if ($Value -is [int] -or $Value -is [long] -or $Value -is [decimal] -or $Value -is [double]) {
    return [string]$Value
  }
  $escaped = ([string]$Value).Replace("'", "''")
  $literal = "'$escaped'"
  if ($Cast) { return "$literal::$Cast" }
  return $literal
}

function Sql-Json {
  param($Value)
  if ($null -eq $Value) { return "'{}'::jsonb" }
  $json = $Value | ConvertTo-Json -Depth 30 -Compress
  return Sql-Scalar $json "jsonb"
}

function Row-Value {
  param($Row, [string]$Column, [string]$Type = "scalar")
  $value = $Row.$Column
  if ($Type -eq "jsonb") { return Sql-Json $value }
  return Sql-Scalar $value
}

function Insert-Line {
  param([string]$Table, [string[]]$Columns, [string[]]$Values)
  "insert into public.$Table ($($Columns -join ",")) values ($($Values -join ",")) on conflict do nothing;"
}

Write-Host "Exporting Supabase data..."
$tables = "users","common_codes","app_settings","defect_save_error_logs","defect_history"
$export = [ordered]@{}
foreach ($table in $tables) {
  $export[$table] = @(Get-SupabaseTable $table)
  Write-Host "$table`: $($export[$table].Count) rows"
}
$export["defects"] = @(Get-RecentDefectsByTestTypes $export.common_codes)
Write-Host "defects total selected: $($export.defects.Count) rows"
$export | ConvertTo-Json -Depth 30 | Set-Content -Encoding UTF8 $BackupJsonPath

$sql = New-Object System.Collections.Generic.List[string]
$sql.Add("begin;")
$sql.Add("truncate table public.defect_history restart identity cascade;")
$sql.Add("truncate table public.defect_save_error_logs restart identity cascade;")
$sql.Add("truncate table public.app_settings cascade;")
$sql.Add("truncate table public.common_codes restart identity cascade;")
$sql.Add("truncate table public.defects cascade;")
$sql.Add("truncate table public.users cascade;")

foreach ($row in @($export.users)) {
  $cols = "user_id","email","password","name","department","role","status","needs_password_reset","created_at","updated_at"
  $vals = $cols | ForEach-Object { Row-Value $row $_ }
  $sql.Add((Insert-Line "users" $cols $vals))
}

foreach ($row in @($export.defects)) {
  $cols = "defect_id","title","test_type","severity","priority","status","steps_to_repro","menu_name","screen_name","screen_url","screenshot","defect_identification","env_info","creator","assignee","action_comment","action_due_date","action_start","action_end","is_deleted","created_at","updated_at"
  $vals = $cols | ForEach-Object { Row-Value $row $_ }
  $sql.Add((Insert-Line "defects" $cols $vals))
}

foreach ($row in @($export.common_codes)) {
  $cols = "group_code","code_value","code_name","color","sort_order","is_active","created_at","updated_at"
  $vals = $cols | ForEach-Object { Row-Value $row $_ }
  $sql.Add((Insert-Line "common_codes" $cols $vals))
}

foreach ($row in @($export.app_settings)) {
  $cols = "key","value","updated_at"
  $vals = @((Row-Value $row "key"), (Row-Value $row "value" "jsonb"), (Row-Value $row "updated_at"))
  $sql.Add((Insert-Line "app_settings" $cols $vals))
}

foreach ($row in @($export.defect_save_error_logs)) {
  $cols = "id","client_log_id","operation","defect_id","pending_source","stage","error_type","message","error_code","error_details","error_hint","runtime_context","payload_summary","extra","reported_by","created_at"
  $vals = @(
    Row-Value $row "id"; Row-Value $row "client_log_id"; Row-Value $row "operation"; Row-Value $row "defect_id";
    Row-Value $row "pending_source"; Row-Value $row "stage"; Row-Value $row "error_type"; Row-Value $row "message";
    Row-Value $row "error_code"; Row-Value $row "error_details"; Row-Value $row "error_hint";
    Row-Value $row "runtime_context" "jsonb"; Row-Value $row "payload_summary" "jsonb"; Row-Value $row "extra" "jsonb";
    Row-Value $row "reported_by"; Row-Value $row "created_at"
  )
  $sql.Add((Insert-Line "defect_save_error_logs" $cols $vals))
}

foreach ($row in @($export.defect_history)) {
  $cols = "id","defect_id","action","status_before","status_after","changed_data","changed_by","created_at"
  $vals = @(
    Row-Value $row "id"; Row-Value $row "defect_id"; Row-Value $row "action"; Row-Value $row "status_before";
    Row-Value $row "status_after"; Row-Value $row "changed_data" "jsonb"; Row-Value $row "changed_by"; Row-Value $row "created_at"
  )
  $sql.Add((Insert-Line "defect_history" $cols $vals))
}

$sql.Add("select setval(pg_get_serial_sequence('public.common_codes','id'), coalesce((select max(id) from public.common_codes), 1), true);")
$sql.Add("select setval(pg_get_serial_sequence('public.defect_save_error_logs','id'), coalesce((select max(id) from public.defect_save_error_logs), 1), true);")
$sql.Add("select setval(pg_get_serial_sequence('public.defect_history','id'), coalesce((select max(id) from public.defect_history), 1), true);")
$sql.Add("commit;")
$sql | Set-Content -Encoding UTF8 $ImportSqlPath

Write-Host "Importing data into local PostgreSQL..."
$env:PGHOST = "127.0.0.1"
$env:PGPORT = "54323"
$env:PGUSER = "postgres"
$env:PGDATABASE = "defect_manage2"
& $Psql -v ON_ERROR_STOP=1 -f $ImportSqlPath
if ($LASTEXITCODE -ne 0) { throw "Local import failed. Check $ImportSqlPath" }

Write-Host "Migration complete."
Write-Host "Backup JSON: $BackupJsonPath"
Write-Host "Import SQL: $ImportSqlPath"
