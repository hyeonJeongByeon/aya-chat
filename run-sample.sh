#!/bin/zsh
# AYA-CHAT Clover — one-time sample launcher
# Starts the local server + a public tunnel, prints the shareable link,
# and keeps the Mac awake while it runs. Stop everything with Ctrl+C.

cd "$(dirname "$0")"
export GCP_PROJECT=dev-cancer-med-health-chatbot
export GCLOUD_BIN=/opt/homebrew/bin/gcloud
export PORT=8090

# Fresh gcloud login check
if ! $GCLOUD_BIN auth print-access-token >/dev/null 2>&1; then
  echo "⚠️  gcloud is not logged in. Run:  gcloud auth login   (Seattle Children's account), then re-run this script."
  exit 1
fi

echo "Starting Clover sample server..."
node server.js & SERVER_PID=$!

echo "Opening public tunnel (takes ~10 seconds)..."
TUNNEL_LOG=$(mktemp)
cloudflared tunnel --url http://localhost:$PORT > "$TUNNEL_LOG" 2>&1 & TUNNEL_PID=$!

cleanup() {
  echo "\nShutting down..."
  kill $SERVER_PID $TUNNEL_PID 2>/dev/null
  exit 0
}
trap cleanup INT TERM

URL=""
for i in {1..30}; do
  sleep 1
  URL=$(grep -o "https://[a-z0-9-]*\.trycloudflare\.com" "$TUNNEL_LOG" | head -1)
  [ -n "$URL" ] && break
done

if [ -z "$URL" ]; then
  echo "❌ Tunnel did not start. Log follows:"; tail -20 "$TUNNEL_LOG"; cleanup
fi

echo ""
echo "=================================================================="
echo "  ✅ SHARE THIS LINK:   $URL"
echo ""
echo "  It opens the 7-day sample directly. AI replies are live."
echo "  Keep this window open and the Mac's lid up while in use."
echo "  The link dies when you press Ctrl+C or close this window."
echo "=================================================================="
echo ""

# Keep the Mac awake for as long as this script runs.
caffeinate -dims -w $SERVER_PID
cleanup
