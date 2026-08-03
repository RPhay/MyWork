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

# --- Stop any existing dev server -----------------------------------------------

$existingProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -like "*npm*run*dev*" -or $_.CommandLine -like "*node*"}
if ($existingProcess) {
    Write-Host "Stopping existing dev server..."
    Stop-Process -InputObject $existingProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
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
    Write-Host "Starting dev server... (logs: /tmp/mywork-dev.log)"
    $devProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" `
        -NoNewWindow `
        -RedirectStandardOutput "/tmp/mywork-dev.log" `
        -RedirectStandardError "/tmp/mywork-dev-error.log" `
        -PassThru

    Write-Host "Waiting for server to start (up to 30 seconds, press Ctrl+C to skip)..."
    $upped = $false
    try {
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Seconds 1

            # Check if process has crashed
            if ($devProcess.HasExited) {
                Write-Host ""
                Write-Error "Dev server crashed! Check logs:"
                Write-Host "STDOUT: /tmp/mywork-dev.log"
                Write-Host "STDERR: /tmp/mywork-dev-error.log"
                Get-Content /tmp/mywork-dev-error.log -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  $_" }
                exit 1
            }

            if (Test-ServerUp) {
                $upped = $true
                Write-Host ""
                Write-Host "✓ Server is ready!"
                break
            }
            Write-Host "." -NoNewline
        }
    } catch {
        # User pressed Ctrl+C
        Write-Host ""
        Write-Host "Interrupted. Server is running in the background."
        Write-Host "Logs: /tmp/mywork-dev.log"
    }

    if (-not $upped) {
        Write-Host "⚠ Server is still starting (this sometimes takes a moment). Check logs at /tmp/mywork-dev.log"
        Write-Host "You can continue and refresh the browser in a moment."
    }
} else {
    Write-Host "✓ Server already running on port $Port."
}

Write-Host "Opening $Url in Chrome..."
# Start-Process -ArgumentList re-joins array elements into a single command
# string and re-splits it, so "Google Chrome" loses its quoting and `open`
# sees -a, Google, Chrome, <url> as four separate args (and tries to open
# "Chrome" as a file). The call operator passes each argument through as-is.
& open -a "Google Chrome" $Url
