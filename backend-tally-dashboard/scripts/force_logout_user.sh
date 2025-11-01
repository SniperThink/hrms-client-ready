#!/usr/bin/env bash
# scripts/force_logout_user.sh
# Usage: ./scripts/force_logout_user.sh [email]
# Defaults to test@testing.com if no email is provided.

set -euo pipefail

BASE_URL="http://127.0.0.1:8000/api/"
EMAIL="${1:-test@client.com}"

# The ForceLogoutView uses only email and is AllowAny, so we can call it without auth.
RESPONSE=$(curl -s -X POST "${BASE_URL}auth/force-logout/" -H "Content-Type: application/json" -d "{\"email\": \"${EMAIL}\"}")

echo "Request: POST ${BASE_URL}auth/force-logout/"
echo "Payload: { email: ${EMAIL} }"
echo "Response:"
echo "${RESPONSE}"
