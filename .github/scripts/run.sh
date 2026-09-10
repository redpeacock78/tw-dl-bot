#!/usr/bin/env bash
set -euo pipefail

readonly WORKSPACE="${GITHUB_WORKSPACE:-$PWD}"
readonly MAX_RETRIES=1000
readonly MAX_FILE_SIZE=10485760
readonly CALLBACK_RETRIES=15
readonly CALLBACK_DELAY=2
readonly CALLBACK_TIMEOUT=60
readonly BEST_EFFORT_TIMEOUT=10
readonly CALLBACK_CONNECT_TIMEOUT=10
readonly RETRY_CURL="${WORKSPACE}/.github/scripts/retry_curl.sh"

event_payload_value() {
  local key="${1}"
  jq -r --arg key "${key}" '.client_payload[$key] // empty' "${GITHUB_EVENT_PATH}"
}

shard_payload_value() {
  local key="${1}"
  jq -r \
    --arg key "${key}" \
    --arg index "${SHARD_INDEX}" \
    '.client_payload.links[(($index | tonumber) - 1)][$key] // empty' \
    "${GITHUB_EVENT_PATH}"
}

load_event_payload() {
  local event_path="${GITHUB_EVENT_PATH:-}"
  RUN_NUMBER="${RUN_NUMBER:-${GITHUB_RUN_NUMBER:-0}}"

  if [[ -n "${event_path}" && -f "${event_path}" ]]; then
    COMMAND_TYPE="$(event_payload_value commandType)"
    START_TIME="$(event_payload_value startTime)"
    CHANNEL="$(event_payload_value channel)"
    MESSAGE="$(event_payload_value message)"
    TOKEN="$(event_payload_value token)"
    LINK="$(event_payload_value link)"

    if [[ "${SHARD_INDEX:-}" =~ ^[0-9]+$ ]]; then
      LINK="$(shard_payload_value link)"
      MESSAGE="$(shard_payload_value message)"
    fi
  fi

  if [[ -n "${MATRIX_LINK:-}" ]]; then
    LINK="${MATRIX_LINK}"
  fi
  if [[ -n "${MATRIX_MESSAGE:-}" ]]; then
    MESSAGE="${MATRIX_MESSAGE}"
  fi
}

load_event_payload

set_output() {
  local name="${1}"
  local value="${2}"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s=%s\n' "${name}" "${value}" >> "${GITHUB_OUTPUT}"
  fi
}

callback_json() {
  local status="${1}"
  local content="${2}"
  local is_thread=false
  case "${COMMAND_TYPE:-}" in
    threaddl|threaddl-spoiler) is_thread=true ;;
  esac

  jq -cn \
    --arg status "${status}" \
    --argjson number "${RUN_NUMBER:-0}" \
    --arg startTime "${START_TIME:-}" \
    --arg channel "${CHANNEL:-}" \
    --arg message "${MESSAGE:-}" \
    --arg token "${TOKEN:-}" \
    --arg link "${LINK:-}" \
    --arg commandType "${COMMAND_TYPE:-}" \
    --arg shardIndex "${SHARD_INDEX:-}" \
    --argjson isThread "${is_thread}" \
    --arg content "${content}" \
    '{status: $status, number: $number, startTime: $startTime, channel: $channel, message: $message, token: $token, link: $link, content: $content}
     + (if $isThread then {commandType: $commandType} else {} end)
     + (if ($isThread and $shardIndex != "") then {shardIndex: $shardIndex} else {} end)'
}

post_callback() {
  local mode="${1:-retry}"
  local max_attempts="${2:-1}"
  shift 2

  if [[ "${mode}" == "best-effort" ]]; then
    curl -s -o /dev/null \
      --connect-timeout "${CALLBACK_CONNECT_TIMEOUT}" \
      --max-time "${BEST_EFFORT_TIMEOUT}" \
      -X POST \
      "${@}" \
      "${ENDPOINT_URL:-}" || true
    return 0
  fi

  local -a curl_args=(
    -X POST
    --connect-timeout "${CALLBACK_CONNECT_TIMEOUT}"
    -m "${CALLBACK_TIMEOUT}"
    "${@}"
    "${ENDPOINT_URL:-}"
  )

  local retry=0
  while (( retry < max_attempts )); do
    if (( max_attempts > 1 )); then
      echo "Retry count: ${retry}"
    fi
    if bash "${RETRY_CURL}" "${CALLBACK_RETRIES}" "${CALLBACK_DELAY}" -- \
      "${curl_args[@]}"; then
      return 0
    fi
    retry=$((retry + 1))
  done
  return 1
}

post_json() {
  post_callback "${2:-retry}" 1 \
    -H "Accept: application/json" \
    -H "Content-type: application/json" \
    -d "${1}"
}

post_progress() {
  local content="${1}"
  local mode="${2:-retry}"
  post_json "$(callback_json progress "${content}")" "${mode}"
}

post_failure() {
  post_json "$(callback_json failure "${1}")"
}

mask_secrets() {
  local value
  for value in \
    "${COMMAND_TYPE:-}" \
    "${LINK:-}" \
    "${CHANNEL:-}" \
    "${MESSAGE:-}" \
    "${TOKEN:-}"; do
    if [[ -n "${value}" ]]; then
      printf '::add-mask::%s\n' "${value}"
    fi
  done
}

setup_ytdlp() {
  post_progress "🛠Setup..." best-effort

  if ! command -v yt-dlp >/dev/null 2>&1; then
    return 0
  fi

  local retry=0
  local nightly_url="https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp"
  local version

  while (( retry < MAX_RETRIES )); do
    echo "Retry count: ${retry}"
    version="$(curl -sI -m "${CALLBACK_TIMEOUT}" --retry 100 --retry-all-errors "${nightly_url}" | grep 'location: ' | awk -F '/' '{print $8}' || true)"
    if yt-dlp --update-to "nightly@${version}"; then
      return 0
    fi
    retry=$((retry + 1))
  done

  echo "yt-dlp nightly update failed; continuing with the installed version." >&2
}

install_scripts() {
  cp "${WORKSPACE}/.github/scripts/progress.awk" "${WORKSPACE}/progress.awk"
  cp "${WORKSPACE}/.github/scripts/conv_progress.sh" /usr/local/bin/conv_progress.sh
  cp "${WORKSPACE}/.github/scripts/retry_curl.sh" /usr/local/bin/retry_curl.sh
  cp "${WORKSPACE}/.github/scripts/post_process.sh" /usr/local/bin/post_process.sh
  chmod +x /usr/local/bin/conv_progress.sh /usr/local/bin/retry_curl.sh /usr/local/bin/post_process.sh
}

ordered_files_in() {
  local directory="${1}"
  local -n result="${2}"
  result=()

  while IFS= read -r file_name; do
    [[ -n "${file_name}" ]] && result+=("${directory}/${file_name}")
  done < <(cd "${directory}" && ls -tr)
}

file_size() {
  wc -c < "${1}" | tr -d '[:space:]'
}

has_video_files() {
  local directory="${1}"
  local files=()
  local file_name
  ordered_files_in "${directory}" files

  for file_name in "${files[@]}"; do
    if ffprobe -v error -f lavfi "movie=${file_name}" >/dev/null 2>&1; then
      return 0
    fi
  done
  return 1
}

check_link() {
  if [[ ! "${LINK:-}" =~ ^http.*$ ]]; then
    return 0
  fi

  post_progress "🔍Checking link status..." retry || true

  local retry=0
  local status=""
  while (( retry < MAX_RETRIES )); do
    if (( retry > 0 )); then
      post_progress "🔍Checking link status...(Retry ${retry} / ${MAX_RETRIES})" retry || true
    fi

    echo "Retry count: ${retry}"
    status="$(curl -sL -m "${CALLBACK_TIMEOUT}" --retry 100 --retry-all-errors "${LINK}" -o /dev/null -w '%{http_code}\n' || true)"
    case "${status}" in
      200|302|307)
        return 0
        ;;
    esac
    retry=$((retry + 1))
    sleep 1
  done

  set_output status notfound
  return 2
}

download_files() {
  post_progress "⏬Downloading..." retry || true

  local download_dir="${WORKSPACE}/download"
  local cookie_path="${WORKSPACE}/cookie.txt"
  local url
  url="$(printf '%s\n' "${LINK}" | awk -F '/' '{OFS="/";sub(/^x.com$/,"twitter.com",$3);print $0}')"
  mkdir -p "${download_dir}"
  cd "${download_dir}"

  local retry=0
  local flag=false
  local not_video=false

  while (( retry < MAX_RETRIES )) && [[ "${flag}" != true ]]; do
    echo "Retry count: ${retry}"

    if (( retry > 0 )); then
      post_progress "⏬Downloading...(Retry ${retry} / ${MAX_RETRIES})" retry || true
    fi

    local yt_result
    local yt_status=0
    local last_line
    local options=()
    yt_result="$(mktemp)"

    if [[ "${url}" == */twitter.com/* ]]; then
      if [[ ! -f "${cookie_path}" ]]; then
        printf '%s\n' "${TWITTER_COOKIES:-}" > "${cookie_path}"
      fi
      options+=(--cookies "${cookie_path}")
    fi

    if ! yt-dlp \
      -R 1000 \
      --force-overwrites \
      --downloader aria2c \
      --external-downloader-args "--listen-port=5502 --dht-listen-port=5502 -s20 -j20 -x16 -k20M --disable-ipv6=true --continue=true --seed-time=0 --max-tries=0 --retry-wait=10 --summary-interval=0 --file-allocation=none --console-log-level=error --download-result=hide" \
      --exec "post_process:post_process.sh {}" \
      -o "%(id).150B_%(autonumber)s.%(ext)s" \
      "${options[@]}" \
      "${url}" > "${yt_result}" 2>&1; then
      yt_status=1
    fi

    last_line="$(tail -n1 "${yt_result}" || true)"
    rm -f "${yt_result}"

    if (( yt_status == 0 )); then
      if [[ "${last_line}" != *"No video"* ]] && has_video_files "${download_dir}"; then
        flag=true
      fi
    elif [[ "${last_line}" == *"No video"* ]]; then
      flag=true
      not_video=true
    elif [[ "${last_line}" == *"Finished downloading playlist"* ]]; then
      local files=()
      ordered_files_in "${download_dir}" files
      if ((${#files[@]} > 0)) && has_video_files "${download_dir}"; then
        flag=true
      elif ((${#files[@]} == 0)); then
        not_video=true
      fi
    fi

    if [[ "${flag}" != true ]]; then
      retry=$((retry + 1))
      sleep 1
    fi
  done

  if [[ "${not_video}" == true ]]; then
    set_output status notvideo
    return 2
  fi
  [[ "${flag}" == true ]]
}

post_form() {
  post_callback retry "${MAX_RETRIES}" \
    -H "Content-type: multipart/form-data" \
    "${@}"
}

callback_form_options() {
  local action_type="${1}"
  local converted="${2}"
  local oversize="${3}"
  local size="${4}"
  local -n options_ref="${5}"

  # shellcheck disable=SC2034
  options_ref=(
    -F "status=success"
    -F "number=${RUN_NUMBER:-0}"
    -F "commandType=${COMMAND_TYPE:-}"
    -F "actionType=${action_type}"
    -F "convert=${converted}"
    -F "oversize=${oversize}"
    -F "size=${size}"
    -F "startTime=${START_TIME:-}"
    -F "channel=${CHANNEL:-}"
    -F "message=${MESSAGE:-}"
    -F "token=${TOKEN:-}"
    -F "link=${LINK:-}"
  )

  if [[ "${COMMAND_TYPE:-}" != "" && "${SHARD_INDEX:-}" != "" ]]; then
    options_ref+=(
      -F "shardIndex=${SHARD_INDEX}"
    )
  fi
}

upload_single() {
  local file_path="${1}"
  local file_name="${2}"
  local converted="${3}"
  local size="${4}"
  local -a options=()
  local action_type="single"
  if [[ "${COMMAND_TYPE:-}" != "" && "${SHARD_INDEX:-}" != "" ]]; then
    action_type="thread-single"
  fi
  callback_form_options "${action_type}" "${converted}" false "${size}" options
  options+=(
    -F "name1=${file_name}"
    -F "file1=@${file_path}"
  )
  post_form "${options[@]}"
}

human_size() {
  awk -v bytes="${1}" 'BEGIN {
    suffix = "B"
    if (bytes >= 1073741824) { bytes /= 1073741824; suffix = "GB" }
    else if (bytes >= 1048576) { bytes /= 1048576; suffix = "MB" }
    else if (bytes >= 1024) { bytes /= 1024; suffix = "KB" }
    if (bytes == int(bytes)) printf "%d%s\n", bytes, suffix
    else printf "%.1f%s\n", bytes, suffix
  }'
}

directory_human_size() {
  local directory="${1}"
  local files=()
  local file_path
  local total=0
  ordered_files_in "${directory}" files

  for file_path in "${files[@]}"; do
    total=$((total + $(file_size "${file_path}")))
  done
  human_size "${total}"
}

upload_files() {
  post_progress "⏫Uploading..." retry || true

  local download_dir="${WORKSPACE}/download"
  local converted_dir="${WORKSPACE}/conv"
  local files=()
  ordered_files_in "${download_dir}" files
  local files_num="${#files[@]}"
  if (( files_num == 0 )); then
    return 1
  fi

  if (( files_num == 1 )); then
    local original="${files[0]}"
    local original_name="${original##*/}"
    local original_size
    original_size="$(file_size "${original}")"
    if (( original_size <= MAX_FILE_SIZE )); then
      echo "Total size: ${original_size}"
      upload_single "${original}" "${original_name}" false "${original_size}"
      return
    fi

    local converted="${converted_dir}/${original_name%.*}.mp4"
    if [[ ! -f "${converted}" ]]; then
      set_output status sizeover
      return 2
    fi
    local converted_size
    converted_size="$(file_size "${converted}")"
    if (( converted_size > MAX_FILE_SIZE )); then
      set_output status sizeover
      return 2
    fi
    echo "Total size: ${converted_size}"
    upload_single "${converted}" "${original_name%.*}.mp4" true "${converted_size}"
    return
  fi

  local selected_files=()
  local selected_names=()
  local selected_total=0
  local converted_used=false
  local original
  for original in "${files[@]}"; do
    local original_name="${original##*/}"
    local original_size
    original_size="$(file_size "${original}")"
    local selected="${original}"
    local selected_name="${original_name}"
    if (( original_size > MAX_FILE_SIZE )); then
      selected="${converted_dir}/${original_name%.*}.mp4"
      selected_name="${original_name%.*}.mp4"
      if [[ ! -f "${selected}" ]] || (( $(file_size "${selected}") > MAX_FILE_SIZE )); then
        set_output status sizeover
        return 2
      fi
      converted_used=true
    fi
    selected_files+=("${selected}")
    selected_names+=("${selected_name}")
    selected_total=$((selected_total + $(file_size "${selected}")))
  done

  local oversize=false
  if (( selected_total > MAX_FILE_SIZE * files_num )); then
    oversize=true
  fi
  echo "Total size: ${selected_total}"

  local -a options=()
  local action_type="multi"
  if [[ "${COMMAND_TYPE:-}" != "" && "${SHARD_INDEX:-}" != "" ]]; then
    action_type="thread-multi"
  fi
  callback_form_options "${action_type}" "${converted_used}" "${oversize}" "${selected_total}" options
  local index=0
  while (( index < files_num )); do
    options+=(
      -F "name${index}=${selected_names[${index}]}"
      -F "file${index}=@${selected_files[${index}]}"
    )
    index=$((index + 1))
  done
  post_form "${options[@]}"
}

failure() {
  case "${1}" in
    expired)
      post_failure "Sorry! This link has expired."
      ;;
    notvideo)
      post_failure "Sorry, The video file did not exist at this link!"
      ;;
    sizeover)
      local original_size="unknown"
      local converted_size="unknown"
      original_size="$(directory_human_size "${WORKSPACE}/download" || printf '%s' 'unknown')"
      converted_size="$(directory_human_size "${WORKSPACE}/conv" || printf '%s' 'unknown')"
      post_failure $'Sorry, The file could not be uploaded because its size exceeds 10MB!\nFile Size: '"${original_size}"' -> '"${converted_size}"
      ;;
    timeout)
      sleep 5
      post_failure "Sorry! Processing time exceeded 10 minutes and timed out."
      ;;
    *)
      echo "Unknown failure type: ${1}" >&2
      return 64
      ;;
  esac
}

cleanup() {
  echo "🧹 Cleaning up temporary files..."
  rm -rf -- \
    "${WORKSPACE}/download" \
    "${WORKSPACE}/conv" \
    "${WORKSPACE}/analyze"
  rm -f -- \
    "${WORKSPACE}/cookie.txt" \
    "${WORKSPACE}/secrets.txt" \
    "${WORKSPACE}/progress.awk" \
    /usr/local/bin/conv_progress.sh \
    /usr/local/bin/retry_curl.sh \
    /usr/local/bin/post_process.sh
}

main() {
  case "${1:-}" in
    mask)
      mask_secrets
      ;;
    start)
      post_progress "⏳Starting..." best-effort
      ;;
    setup)
      setup_ytdlp
      ;;
    install)
      install_scripts
      ;;
    check-link)
      check_link
      ;;
    download)
      download_files
      ;;
    upload)
      upload_files
      ;;
    failure)
      failure "${2:-}"
      ;;
    cleanup)
      cleanup
      ;;
    *)
      echo "Usage: $0 {mask|start|setup|install|check-link|download|upload|failure|cleanup}" >&2
      return 64
      ;;
  esac
}

main "${@}"
