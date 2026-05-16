#!/usr/bin/env bash
# Mexus SessionStart hook.
#
# Loaded into Claude Code via `claude --plugin-dir <this-package>`.
# Reads the hook input JSON from stdin, extracts session_id, and POSTs it
# to the Mexus server so the pane's sessionId can be persisted for auto-resume.
#
# Required env (injected by Mexus when spawning the agent):
#   MEXUS_PANE_ID       — opaque pane identifier
#   MEXUS_BIND_URL      — full URL of the bind endpoint
#                         (e.g. http://127.0.0.1:7700/api/internal/session-bind)
#   MEXUS_BIND_TOKEN    — one-shot token used to authenticate this hook
#
# Optional env:
#   MEXUS_PLUGIN_DEBUG  — when set to "1", append diagnostic logs
#                         to MEXUS_PLUGIN_LOG (default /tmp/mexus-plugin.log)
#
# Always exits 0 so a missing/unreachable Mexus server never breaks the agent.

set -u

LOG_FILE="${MEXUS_PLUGIN_LOG:-/tmp/mexus-plugin.log}"

log() {
  if [ "${MEXUS_PLUGIN_DEBUG:-}" = "1" ]; then
    printf '[%s] %s\n' "$(date -Iseconds)" "$*" >> "$LOG_FILE" 2>/dev/null || true
  fi
}

input="$(cat || true)"
log "SessionStart fired. input=$input pane=${MEXUS_PANE_ID:-} url=${MEXUS_BIND_URL:-}"

if [ -z "${MEXUS_PANE_ID:-}" ] || [ -z "${MEXUS_BIND_URL:-}" ]; then
  log "skip: missing MEXUS_PANE_ID or MEXUS_BIND_URL"
  exit 0
fi

# Extract session_id without hard-depending on jq.
session_id=""
if command -v jq >/dev/null 2>&1; then
  session_id="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null || true)"
fi
if [ -z "$session_id" ]; then
  session_id="$(printf '%s' "$input" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]\{1,\}\)".*/\1/p' | head -n1)"
fi

if [ -z "$session_id" ]; then
  log "skip: could not extract session_id"
  exit 0
fi

source_field="$(printf '%s' "$input" | sed -n 's/.*"source"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"

payload=$(printf '{"paneId":"%s","sessionId":"%s","agent":"claudecode","source":"%s"}' \
  "$MEXUS_PANE_ID" "$session_id" "${source_field:-startup}")

log "POST $MEXUS_BIND_URL payload=$payload"

curl --silent --show-error --max-time 3 \
  -X POST "$MEXUS_BIND_URL" \
  -H 'Content-Type: application/json' \
  ${MEXUS_BIND_TOKEN:+-H "X-Mexus-Token: $MEXUS_BIND_TOKEN"} \
  --data "$payload" \
  >> "$LOG_FILE" 2>&1 || log "curl failed (server may be down)"

exit 0
