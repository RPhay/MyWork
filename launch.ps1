# Starts the MyWork dev server (if not already running) and opens it in Chrome.

$Port = 3000
$Url = "http://localhost:$Port"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Set-Location $ScriptDir

function Test-ServerUp {
    try {
        $response = Invoke-WebRequest -Uri "$Url/health" -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

if (-not (Test-ServerUp)) {
    Write-Host "Starting dev server..."
    Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WindowStyle Hidden

    $upped = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        if (Test-ServerUp) {
            $upped = $true
            break
        }
    }

    if (-not $upped) {
        Write-Error "Server did not come up in time."
        exit 1
    }
} else {
    Write-Host "Server already running on port $Port."
}

Write-Host "Opening $Url in Chrome..."
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chrome) {
    Start-Process -FilePath $chrome -ArgumentList $Url
} else {
    Write-Warning "Chrome not found in common install locations - opening with default browser."
    Start-Process $Url
}
