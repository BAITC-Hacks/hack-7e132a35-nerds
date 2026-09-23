$ErrorActionPreference = 'Stop'
$projectPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectPath
$locationFile = Join-Path $projectPath '.local-postgres/bin-location.txt'
if (!(Test-Path -LiteralPath $locationFile)) { throw 'Run setup-postgres.ps1 first or start your own PostgreSQL.' }
$pgBin = (Get-Content -LiteralPath $locationFile -Raw).Trim()
$pgData = Join-Path $projectPath '.local-postgres/data'
& (Join-Path $pgBin 'pg_ctl.exe') -D $pgData status | Out-Null
if ($LASTEXITCODE -ne 0) {
  Start-Process -FilePath (Join-Path $pgBin 'postgres.exe') -ArgumentList @('-D', ('"' + $pgData + '"'), '-h', '127.0.0.1', '-p', '54329') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectPath '.local-postgres/server-out.log') -RedirectStandardError (Join-Path $projectPath '.local-postgres/server-error.log')
  for ($attempt=0; $attempt -lt 30; $attempt++) {
    & (Join-Path $pgBin 'pg_isready.exe') -h 127.0.0.1 -p 54329 | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Milliseconds 500
  }
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL failed to start. See .local-postgres/server-error.log.' }
}
Write-Host 'PostgreSQL ready. Opening server at http://localhost:3000'
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000
