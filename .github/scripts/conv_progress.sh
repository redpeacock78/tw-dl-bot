#!/usr/bin/env bash
# Read runtime values from environment variables set by the calling workflow step.
# Required: ENDPOINT_URL, RUN_NUMBER, START_TIME, CHANNEL, MESSAGE, TOKEN, LINK
# Optional: COMMAND_TYPE  (set only for /threaddl and /threaddl-spoiler variants)
# Optional: SHARD_INDEX   (zero-padded matrix shard index, e.g. "01"; when set
#                          the bot renders the run number as "#N-XX" in Discord)
#
# Positional arguments:
#   $1 - progress log file path (monitored for changes)
#   $2 - current file index (1-based, shown in "N / total" label)
#   $3 - total file count
#   $4 - phase label (e.g. "🔎Probing...", "🧪Analyzing...", "🔁Converting...")
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly RETRY_CURL="${SCRIPT_DIR}/retry_curl.sh"
readonly MAX_RETRIES=1000
readonly CALLBACK_RETRIES=15
readonly CALLBACK_DELAY=2
readonly CALLBACK_TIMEOUT=60
readonly CALLBACK_CONNECT_TIMEOUT=10

progress_file="${1}"
file_index="${2}"
total_files="${3}"
phase="${4}"
run_number="${RUN_NUMBER}"
start_time="${START_TIME}"
command_type="${COMMAND_TYPE:-}"
shard_index="${SHARD_INDEX:-}"
is_thread=false
case "${command_type}" in
  threaddl|threaddl-spoiler) is_thread=true ;;
esac
channel="${CHANNEL}"
message="${MESSAGE}"
token="${TOKEN}"
link="${LINK}"

progress_payload() {
  local progress="${1}"
  local content="${phase}(${file_index} / ${total_files})"$'\n'"${progress}"

  jq -cn \
    --arg number "${run_number}" \
    --arg startTime "${start_time}" \
    --arg channel "${channel}" \
    --arg message "${message}" \
    --arg token "${token}" \
    --arg link "${link}" \
    --arg content "${content}" \
    --arg commandType "${command_type}" \
    --arg shardIndex "${shard_index}" \
    --argjson isThread "${is_thread}" \
    '{status: "progress", number: $number, startTime: $startTime, channel: $channel, message: $message, token: $token, link: $link, content: $content}
     + (if $isThread then {commandType: $commandType} else {} end)
     + (if ($isThread and $shardIndex != "") then {shardIndex: $shardIndex} else {} end)'
}

post_progress() {
  local payload="${1}"

  bash "${RETRY_CURL}" "${CALLBACK_RETRIES}" "${CALLBACK_DELAY}" -- \
    -X POST \
    "${ENDPOINT_URL}" \
    --connect-timeout "${CALLBACK_CONNECT_TIMEOUT}" \
    -H "Accept: application/json" \
    -H "Content-type: application/json" \
    -m "${CALLBACK_TIMEOUT}" \
    -d "${payload}"
}

interval=1
last="$(openssl sha256 -r -- "${progress_file}" | awk '{print $1}')"
while true; do
  sleep "${interval}"
  current="$(openssl sha256 -r -- "${progress_file}" | awk '{print $1}')"
  if [[ "${last}" != "${current}" ]]; then
    retry=0
    flag=false
    until "${flag}" || (( retry == MAX_RETRIES )); do
      if (( retry > 0 )); then
        echo "Retry count: ${retry}"
        echo "Flag status: ${flag}"
      fi
      progress="$(tail -n1 "${progress_file}")"
      if grep -q '^/' <<< "${progress}"; then
        progress="00:00:00${progress}"
      fi
      payload="$(progress_payload "${progress}")"
      if post_progress "${payload}"; then
        flag=true
      else
        ((retry++)) || true
      fi
    done
    last="${current}"
  fi
done
