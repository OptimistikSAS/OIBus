# build/sign-kms.ps1
param([string]$FilePath)

# 1. Validation
if (-not (Test-Path $FilePath)) {
    Write-Error "File not found: $FilePath"
    exit 1
}

# 2. Find x64 Signtool (Dynamically)
$signtool = Get-ChildItem -Path "C:\Program Files (x86)\Windows Kits" -Filter "signtool.exe" -Recurse | Where-Object { $_.FullName -like "*x64*" } | Select-Object -First 1 -ExpandProperty FullName

if (-not $signtool) {
    Write-Error "Could not find x64 signtool.exe"
    exit 1
}

Write-Host "Signing $FilePath using $signtool..."

# 3. Execute Signing
# We rely on global Environment Variables ($env:CERT_PATH) set by the CI
# Timestamp servers fail intermittently (signtool then reports 0x80096005 / TRUST_E_TIMESTAMP), so each one is tried
# several times before falling back to the next. Any RFC 3161 server is valid whatever the certificate issuer.
$timestampServers = @('http://timestamp.sectigo.com', 'http://timestamp.digicert.com')
$attemptsPerServer = 3
$delayInSeconds = 15

foreach ($timestampServer in $timestampServers) {
    for ($attempt = 1; $attempt -le $attemptsPerServer; $attempt++) {
        Write-Host "Timestamp server $timestampServer (attempt $attempt/$attemptsPerServer)"
        & $signtool sign /debug /fd SHA256 /tr $timestampServer /td SHA256 /f "$env:CERT_PATH" /csp "Google Cloud KMS Provider" /kc projects/oibus-dev/locations/global/keyRings/sectigo/cryptoKeys/202512-code-signing/cryptoKeyVersions/1 $FilePath

        if ($LASTEXITCODE -eq 0) {
            Write-Host "Signed $FilePath"
            exit 0
        }

        Write-Warning "Signing failed with exit code $LASTEXITCODE"
        Start-Sleep -Seconds $delayInSeconds
    }
}

Write-Error "Signing failed for $FilePath on every timestamp server."
exit 1
