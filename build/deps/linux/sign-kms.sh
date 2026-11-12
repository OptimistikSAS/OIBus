#!/usr/bin/env bash
# build/deps/linux/sign-kms.sh
# Signs files with the OIBus code signing key held in Google Cloud KMS (the one used for the Windows binaries).
# Linux has no embedded signature format, so the signatures are detached and written to <output-dir>:
#   <file name>.sig         raw signature of the SHA-256 digest of each file
#   oibus-code-signing.crt  PEM code signing certificate matching those signatures
# Anyone can then check a file with:
#   openssl dgst -sha256 -verify <(openssl x509 -in oibus-code-signing.crt -pubkey -noout) -signature <file name>.sig <file>
#
# Requires gcloud to be authenticated and CERT_BASE64_CONTENT to hold the base64 encoded certificate.
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo 'Usage: sign-kms.sh <output-dir> <file>...' >&2
  exit 1
fi
OUTPUT_DIR="$1"
shift
CERT_PATH="$OUTPUT_DIR/oibus-code-signing.crt"
KMS_PROJECT='oibus-dev'
KMS_LOCATION='global'
KMS_KEYRING='sectigo'
KMS_KEY='202512-code-signing'
KMS_KEY_VERSION='1'

for file_path in "$@"; do
  if [ ! -f "$file_path" ]; then
    echo "File not found: $file_path" >&2
    exit 1
  fi
done
if [ -z "${CERT_BASE64_CONTENT:-}" ]; then
  echo 'CERT_BASE64_CONTENT is not set' >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# 1. Turn the certificate secret into one PEM file per certificate, whatever its format (DER, PEM or PKCS#7 bundle)
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

mkdir -p "$OUTPUT_DIR"

for file_path in "$@"; do
  signature_path="$OUTPUT_DIR/$(basename "$file_path").sig"

  # 2. Sign
  echo "Signing $file_path with Cloud KMS key $KMS_KEY..."
  gcloud kms asymmetric-sign \
    --project "$KMS_PROJECT" --location "$KMS_LOCATION" --keyring "$KMS_KEYRING" --key "$KMS_KEY" --version "$KMS_KEY_VERSION" \
    --digest-algorithm sha256 \
    --input-file "$file_path" \
    --signature-file "$signature_path"

  # 3. Keep the certificate the signature verifies against. This also proves the signature is valid.
  verified=false
  for candidate in "$WORK_DIR"/cert-*.pem; do
    [ -f "$candidate" ] || continue
    openssl x509 -in "$candidate" -pubkey -noout > "$WORK_DIR/public-key.pem" 2>/dev/null || continue
    if openssl dgst -sha256 -verify "$WORK_DIR/public-key.pem" -signature "$signature_path" "$file_path" > /dev/null 2>&1; then
      openssl x509 -in "$candidate" -out "$CERT_PATH"
      echo "Signature verified against: $(openssl x509 -in "$CERT_PATH" -noout -subject)"
      verified=true
      break
    fi
  done

  if [ "$verified" != true ]; then
    echo "The signature of $file_path does not verify against the code signing certificate." >&2
    rm -f "$signature_path"
    exit 1
  fi
done
