$ErrorActionPreference = 'Stop'

$projectCandidates = @(
  'C:\Users\1\Desktop\蝶变 AI 小程序',
  'C:\Users\1\Desktop\蝶变AI小程序'
)

$projectRoot = $projectCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $projectRoot) {
  throw "Project directory not found. Checked: $($projectCandidates -join ', ')"
}

function Stop-PortProcess {
  param([int]$Port)

  $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $processIds) {
    if (-not $processId -or $processId -eq 0) {
      continue
    }
    try {
      $process = Get-Process -Id $processId -ErrorAction Stop
      Write-Host "[e2e-local] Releasing port $Port from PID $processId ($($process.ProcessName))"
      Stop-Process -Id $processId -Force -ErrorAction Stop
    } catch {
      Write-Host "[e2e-local] Port $Port PID $processId could not be stopped: $($_.Exception.Message)"
    }
  }
}

function Wait-H5Ready {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -eq 200) {
        Write-Host "[e2e-local] H5_STATUS=200"
        return
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  throw "H5 service did not become ready at $Url within $TimeoutSeconds seconds."
}

Set-Location -LiteralPath $projectRoot
Write-Host "[e2e-local] Project root: $projectRoot"

Stop-PortProcess -Port 9520
Stop-PortProcess -Port 8080

Write-Host '[e2e-local] Installing npm dependencies...'
& npm.cmd install
if ($LASTEXITCODE -ne 0) {
  throw "npm install failed with exit code $LASTEXITCODE"
}

$env:PLAYWRIGHT_BROWSERS_PATH = '.ms-playwright'
$serveOut = Join-Path $projectRoot 'tmp-serve-h5.out.log'
$serveErr = Join-Path $projectRoot 'tmp-serve-h5.err.log'
Remove-Item -LiteralPath $serveOut, $serveErr -Force -ErrorAction SilentlyContinue

Write-Host '[e2e-local] Starting local H5 service...'
$serveProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'serve:h5:local') -WorkingDirectory $projectRoot -PassThru -RedirectStandardOutput $serveOut -RedirectStandardError $serveErr -WindowStyle Hidden

try {
  Wait-H5Ready -Url 'http://127.0.0.1:8080/#/' -TimeoutSeconds 30

  Write-Host '[e2e-local] Running single result spec...'
  & npx.cmd jest tests/result/mark-needs-revision.spec.js --config jest.h5.local.config.js --runInBand --detectOpenHandles
  if ($LASTEXITCODE -ne 0) {
    throw "single result spec failed with exit code $LASTEXITCODE"
  }
} finally {
  if ($serveProcess -and -not $serveProcess.HasExited) {
    Stop-Process -Id $serveProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
