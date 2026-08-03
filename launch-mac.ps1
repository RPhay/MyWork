# macOS-only launcher (PowerShell Core / pwsh): checks/installs prerequisites,
# starts the MyWork dev server (if not already running), and opens it in Chrome.
# For a plain shell equivalent, use launch-mac.sh instead.

$Port = 3000
$Url = "http://localhost:$Port"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Set-Location $ScriptDir

if (-not $IsMacOS) {
    Write-Error "launch-mac.ps1 is macOS-only (run it with pwsh on a Mac)."
    exit 1
}

# --- Dependencies ---------------------------------------------------------

if (-not (Get-Command brew -ErrorAction SilentlyContinue)) {
    Write-Error "Homebrew isn't installed. Install it from https://brew.sh, then run: brew install node"
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is not installed. Installing via Homebrew..."
    brew install node
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm isn't available even though Node.js is installed - your Node install looks broken. Try: brew reinstall node"
    exit 1
}

$needsInstall = -not (Test-Path node_modules)
if (-not $needsInstall) {
    $nodeModulesTime = (Get-Item node_modules).LastWriteTime
    if ((Get-Item package.json).LastWriteTime -gt $nodeModulesTime) { $needsInstall = $true }
    if ((Test-Path package-lock.json) -and (Get-Item package-lock.json).LastWriteTime -gt $nodeModulesTime) { $needsInstall = $true }
}
if ($needsInstall) {
    Write-Host "Installing npm dependencies..."
    npm install
}

# --- Start the server -------------------------------------------------------

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
    Start-Process -FilePath "npm" -ArgumentList "run", "dev"

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
# Start-Process -ArgumentList re-joins array elements into a single command
# string and re-splits it, so "Google Chrome" loses its quoting and `open`
# sees -a, Google, Chrome, <url> as four separate args (and tries to open
# "Chrome" as a file). The call operator passes each argument through as-is.
& open -a "Google Chrome" $Url
