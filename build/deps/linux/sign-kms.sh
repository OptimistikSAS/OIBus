#!/usr/bin/env bash
# build/deps/linux/sign-kms.sh
# Signs a file with the OIBus code signing key held in Google Cloud KMS (the one used for the Windows binaries).
# Linux has no embedded signature format, so the signature is detached:
#   <file>.sig  raw signature of the SHA-256 digest of the file
#   <file>.crt  PEM code signing certificate matching that signature
# Anyone can then check the file with:
#   openssl dgst -sha256 -verify <(openssl x509 -in <file>.crt -pubkey -noout) -signature <file>.sig <file>
#
# Requires gcloud to be authenticated and CERT_BASE64_CONTENT to hold the base64 encoded certificate.
set -euo pipefail

FILE_PATH="${1:?Usage: sign-kms.sh <file>}"
KMS_PROJECT='oibus-dev'
KMS_LOCATION='global'
KMS_KEYRING='sectigo'
KMS_KEY='202512-code-signing'
KMS_KEY_VERSION='1'

if [ ! -f "$FILE_PATH" ]; then
  echo "File not found: $FILE_PATH" >&2
  exit 1
fi
if [ -z "${CERT_BASE64_CONTENT:-}" ]; then
  echo 'CERT_BASE64_CONTENT is not set' >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# 1. Sign
echo "Signing $FILE_PATH with Cloud KMS key $KMS_KEY..."
gcloud kms asymmetric-sign \
  --project "$KMS_PROJECT" --location "$KMS_LOCATION" --keyring "$KMS_KEYRING" --key "$KMS_KEY" --version "$KMS_KEY_VERSION" \
  --digest-algorithm sha256 \
  --input-file "$FILE_PATH" \
  --signature-file "$FILE_PATH.sig"

# 2. Turn the certificate secret into one PEM file per certificate, whatever its format (DER, PEM or PKCS#7 bundle)
printf '%s' "$CERT_BASE64_CONTENT" | base64 -d > "$WORK_DIR/cert.raw"
if ! openssl x509 -in "$WORK_DIR/cert.raw" -inform DER -out "$WORK_DIR/bundle.pem" 2>/dev/null; then
  if grep -q 'BEGIN CERTIFICATE' "$WORK_DIR/cert.raw"; then
    cp "$WORK_DIR/cert.raw" "$WORK_DIR/bundle.pem"
  elif ! openssl pkcs7 -in "$WORK_DIR/cert.raw" -inform DER -print_certs -out "$WORK_DIR/bundle.pem" 2>/dev/null &&
    ! openssl pkcs7 -in "$WORK_DIR/cert.raw" -inform PEM -print_certs -out "$WORK_DIR/bundle.pem" 2>/dev/null; then
    echo 'Could not read the certificate: expected DER, PEM or PKCS#7' >&2
    exit 1
  fi
fi
awk -v dir="$WORK_DIR" '/BEGIN CERTIFICATE/ { n++ } n { print > (dir "/cert-" n ".pem") }' "$WORK_DIR/bundle.pem"

# 3. Keep the certificate the signature verifies against. This also proves the signature is valid.
for candidate in "$WORK_DIR"/cert-*.pem; do
  [ -f "$candidate" ] || continue
  openssl x509 -in "$candidate" -pubkey -noout > "$WORK_DIR/public-key.pem" 2>/dev/null || continue
  if openssl dgst -sha256 -verify "$WORK_DIR/public-key.pem" -signature "$FILE_PATH.sig" "$FILE_PATH" > /dev/null 2>&1; then
    openssl x509 -in "$candidate" -out "$FILE_PATH.crt"
    echo "Signature verified against: $(openssl x509 -in "$FILE_PATH.crt" -noout -subject)"
    exit 0
  fi
done

echo "The signature of $FILE_PATH does not verify against the code signing certificate." >&2
rm -f "$FILE_PATH.sig"
exit 1
