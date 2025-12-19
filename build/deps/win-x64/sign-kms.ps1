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
& $signtool sign /debug /fd SHA256 /tr http://timestamp.comodoca.com /td SHA256 /f "$env:CERT_PATH" /csp "Google Cloud KMS Provider" /kc projects/oibus-dev/locations/global/keyRings/sectigo/cryptoKeys/202512-code-signing/cryptoKeyVersions/1 $FilePath

if ($LASTEXITCODE -ne 0) {
    Write-Error "Signing failed."
    exit $LASTEXITCODE
}