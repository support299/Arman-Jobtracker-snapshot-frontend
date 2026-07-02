#!/usr/bin/env bash
#
# Deploy frontend to EC2 (snapshot.theservicepilot.com)
#
# Usage:
#   ./deploy.sh              # build + upload
#   ./deploy.sh --skip-build   # upload existing dist/ only
#   ./deploy.sh --pull         # git pull main, then build + upload
#
# Optional env overrides:
#   DEPLOY_SSH_KEY    path to PEM (default: ~/Downloads/service-pilot.pem)
#   DEPLOY_HOST       ssh target (default: ubuntu@ec2-16-59-223-224.us-east-2.compute.amazonaws.com)
#   DEPLOY_REMOTE_DIR nginx web root (default: /var/www/dist)
#   DEPLOY_STAGING_DIR upload staging on server (default: ~/frontend-release)
#   DEPLOY_SITE_URL   URL shown when done (default: https://snapshot.theservicepilot.com)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/Downloads/service-pilot.pem}"
SSH_HOST="${DEPLOY_HOST:-ubuntu@ec2-16-59-223-224.us-east-2.compute.amazonaws.com}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/var/www/dist}"
STAGING_DIR="${DEPLOY_STAGING_DIR:-/home/ubuntu/frontend-release}"
SITE_URL="${DEPLOY_SITE_URL:-https://snapshot.theservicepilot.com}"

SKIP_BUILD=0
GIT_PULL=0

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    --pull) GIT_PULL=1 ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$SSH_KEY" ]]; then
  echo "SSH key not found: $SSH_KEY" >&2
  echo "Set DEPLOY_SSH_KEY or place service-pilot.pem in ~/Downloads/" >&2
  exit 1
fi

chmod 400 "$SSH_KEY" 2>/dev/null || true

SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=20)

if [[ "$GIT_PULL" -eq 1 ]]; then
  echo "==> Pulling latest from origin/main..."
  git pull origin main
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "==> Installing dependencies..."
  npm install

  echo "==> Building production bundle (uses .env + .env.production)..."
  npm run build

  if [[ ! -d dist ]] || [[ ! -f dist/index.html ]]; then
    echo "Build failed: dist/index.html not found" >&2
    exit 1
  fi
else
  if [[ ! -d dist ]] || [[ ! -f dist/index.html ]]; then
    echo "No dist/ folder. Run without --skip-build first." >&2
    exit 1
  fi
  echo "==> Skipping build; uploading existing dist/"
fi

echo "==> Uploading to $SSH_HOST:$STAGING_DIR ..."
ssh "${SSH_OPTS[@]}" "$SSH_HOST" "mkdir -p $STAGING_DIR"
rsync -avz --delete \
  -e "ssh ${SSH_OPTS[*]}" \
  dist/ \
  "$SSH_HOST:$STAGING_DIR/"

echo "==> Publishing to $REMOTE_DIR (requires sudo on server)..."
ssh "${SSH_OPTS[@]}" "$SSH_HOST" bash -s <<EOF
set -euo pipefail
sudo mkdir -p '$REMOTE_DIR'
sudo rsync -a --delete '$STAGING_DIR/' '$REMOTE_DIR/'
sudo chown -R www-data:www-data '$REMOTE_DIR'
EOF

echo ""
echo "Deploy complete."
echo "  Site: $SITE_URL"
echo "  Tip: hard-refresh (Cmd+Shift+R) if you still see the old UI."
