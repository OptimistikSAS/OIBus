# build/deps/win-x64/verify-signature.ps1
# Fails if one of the given files does not carry a valid, timestamped Authenticode signature from the expected publisher
param(
    [Parameter(Mandatory = $true)][string[]]$FilePaths,
    [string]$ExpectedPublisher = 'OPTIMISTIK'
)

$failed = $false

foreach ($filePath in $FilePaths) {
    if (-not (Test-Path $filePath)) {
        Write-Warning "${filePath}: file not found"
        $failed = $true
        continue
    }

    $signature = Get-AuthenticodeSignature -FilePath $filePath
    $problems = @()

    if ($signature.Status -ne 'Valid') {
        $problems += "status is $($signature.Status) ($($signature.StatusMessage))"
    }
    if (-not $signature.SignerCertificate -or $signature.SignerCertificate.Subject -notmatch "CN=$ExpectedPublisher(,|$)") {
        $problems += "signer is '$($signature.SignerCertificate.Subject)', expected CN=$ExpectedPublisher"
    }
    if (-not $signature.TimeStamperCertificate) {
        $problems += 'signature is not timestamped'
    }

    if ($problems.Count -gt 0) {
        Write-Warning "${filePath}: $($problems -join '; ')"
        $failed = $true
    } else {
        Write-Host "${filePath}: signed by $($signature.SignerCertificate.Subject), timestamped by $($signature.TimeStamperCertificate.Subject)"
    }
}

if ($failed) {
    Write-Error 'Signature verification failed.'
    exit 1
}
exit 0
