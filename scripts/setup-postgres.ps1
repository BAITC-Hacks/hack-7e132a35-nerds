$ErrorActionPreference = 'Stop'
$projectPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectPath
if (Test-Path -LiteralPath '.local-postgres/data/PG_VERSION') { throw 'Database already exists. Use start-local.ps1.' }
if ((Test-Path -LiteralPath '.env.local') -and !(Test-Path -LiteralPath 'backup/database.json')) { throw '.env.local already exists. Preserve your configuration; use your configured PostgreSQL.' }
node scripts/download-postgres.mjs
if ($LASTEXITCODE -ne 0) { throw 'Download failed' }
New-Item -ItemType Directory -Force -Path '.local-postgres/vendor' | Out-Null
tar -xf .local-postgres/postgres.tgz -C .local-postgres/vendor
if ($LASTEXITCODE -ne 0) { throw 'Extraction failed' }
$pgBin = Join-Path $projectPath '.local-postgres/vendor/package/native/bin'
Set-Content -LiteralPath '.local-postgres/bin-location.txt' -Value $pgBin
if (!(Test-Path -LiteralPath '.env.local')) {
  node scripts/prepare-local-config.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Configuration failed' }
}
& (Join-Path $pgBin 'initdb.exe') -D .local-postgres/data -U postgres --pwfile=.local-postgres/admin-password.txt --auth=scram-sha-256 --encoding=UTF8 --locale=C
if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed' }
$pgData = Join-Path $projectPath '.local-postgres/data'
Start-Process -FilePath (Join-Path $pgBin 'postgres.exe') -ArgumentList @('-D', ('"' + $pgData + '"'), '-h', '127.0.0.1', '-p', '54329') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectPath '.local-postgres/server-out.log') -RedirectStandardError (Join-Path $projectPath '.local-postgres/server-error.log')
for ($attempt=0; $attempt -lt 30; $attempt++) {
  & (Join-Path $pgBin 'pg_isready.exe') -h 127.0.0.1 -p 54329 | Out-Null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Milliseconds 500
}
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL failed to start' }
node scripts/bootstrap-postgres.mjs
if ($LASTEXITCODE -ne 0) { throw 'Database provisioning failed' }
node --env-file=.env.local scripts/migrate.mjs
if ($LASTEXITCODE -ne 0) { throw 'Migrations failed' }
node --env-file=.env.local scripts/restore-snapshot.mjs --if-empty
if ($LASTEXITCODE -ne 0) { throw 'Snapshot restore failed' }
Write-Host 'Database akim is ready on 127.0.0.1:54329.'
