#!/usr/bin/env bash
declare max="${1}";shift
declare delay="${1}";shift
[[ "${1:-1}" == "--" ]] && shift || true
declare attempt=1
declare status
while (( attempt <= max )); do
  status="$(curl -sS -o /dev/null -w '%{http_code}' "${@}")"
  if [[ "${status}" =~ ^2[0-9][0-9] ]]; then
    exit 0
  fi
  if [[ "${status}" == "499" || "${status}" -ge 500 || "${status}" == "408" || "${status}" == "429" ]]; then
    echo "Retry ${attempt}/${max} failed with status ${status}. Retrying in ${delay} seconds..."
    sleep "${delay}"
    delay=$(( delay * 2 > 60 ? 60 : delay * 2 ))
    ((attempt++))
    continue
  fi
  echo "Non-retriable error: ${status}" >&2
  exit 22
done
echo "Exceeded retries. Last status: ${status}" >&2
exit 22
