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
run_number="${RUN_NUMBER}"
start_time="${START_TIME}"
command_type="${COMMAND_TYPE:-}"
shard_index="${SHARD_INDEX:-}"
channel="${CHANNEL}"
message="${MESSAGE}"
token="${TOKEN}"
link="${LINK}"

interval=1
last="$(openssl sha256 -r ${1} | awk '{print $1}')"
while true; do
  sleep "${interval}"
  current="$(openssl sha256 -r ${1} | awk '{print $1}')"
  if [[ "${last}" != "${current}" ]]; then
    retry=0 && \
    flag=false && \
    until "${flag}" || (( "${retry}" == 1000 )); do
      if ((  "${retry}" > 0 )); then
        echo "Retry count: ${retry}"
        echo "Flag status: ${flag}"
      fi
      progress="$(cat ${1} | tail -n1)"
      if grep -e '^/' <<< "${progress}" > /dev/null; then
        progress="00:00:00${progress}"
      else
        :
      fi
      if [[ -n "${command_type}" && -n "${shard_index}" ]]; then
        payload='{"status": "progress", "number": "'"${run_number}"'", "commandType": "'"${command_type}"'", "shardIndex": "'"${shard_index}"'", "startTime": "'"${start_time}"'", "channel": "'"${channel}"'", "message": "'"${message}"'", "token": "'"${token}"'", "link": "'"${link}"'", "content": "'"${4}(${2} / ${3})\n${progress}"'"}'
      elif [[ -n "${command_type}" ]]; then
        payload='{"status": "progress", "number": "'"${run_number}"'", "commandType": "'"${command_type}"'", "startTime": "'"${start_time}"'", "channel": "'"${channel}"'", "message": "'"${message}"'", "token": "'"${token}"'", "link": "'"${link}"'", "content": "'"${4}(${2} / ${3})\n${progress}"'"}'
      else
        payload='{"status": "progress", "number": "'"${run_number}"'", "startTime": "'"${start_time}"'", "channel": "'"${channel}"'", "message": "'"${message}"'", "token": "'"${token}"'", "link": "'"${link}"'", "content": "'"${4}(${2} / ${3})\n${progress}"'"}'
      fi
      echo "${payload}" | \
      curl -s -X POST \
        "${ENDPOINT_URL}" \
        -H "Accept: application/json" \
        -H "Content-type: application/json" \
        -m 18000 \
        --retry 100 \
        --retry-all-errors \
        -d @- > /dev/null 2>&1 && \
      {
        flag=true
      } || \
      {
        ((retry++)) || true
      }
    done
    last="${current}"
  fi
done
