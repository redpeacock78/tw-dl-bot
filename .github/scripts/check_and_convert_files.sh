#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly WORKSPACE="${GITHUB_WORKSPACE:-$(cd -- "${SCRIPT_DIR}/../.." && pwd)}"
readonly DOWNLOAD_DIR="${WORKSPACE}/download"
readonly MAX_FILE_SIZE=10485760
readonly PROGRESS_AWK="${PROGRESS_AWK:-${WORKSPACE}/progress.awk}"
readonly CONV_PROGRESS="${CONV_PROGRESS:-conv_progress.sh}"

file_size() {
  wc -c < "${1}" | tr -d '[:space:]'
}

cd "${DOWNLOAD_DIR}"

files=()
while IFS= read -r file_name; do
  if [[ -n "${file_name}" ]]; then
    files+=("${file_name}")
  fi
done < <(ls -tr)

total_size=0
for file_name in "${files[@]}"; do
  total_size=$((total_size + $(file_size "${file_name}")))
done

if (( total_size <= MAX_FILE_SIZE )); then
  exit 0
fi

oversized_count=0
for file_name in "${files[@]}"; do
  if (( $(file_size "${file_name}") > MAX_FILE_SIZE )); then
    oversized_count=$((oversized_count + 1))
  fi
done

count=1
for file_name in "${files[@]}"; do
  if (( $(file_size "${file_name}") <= MAX_FILE_SIZE )); then
    continue
  fi

  num="${count}"
  count=$((count + 1))
  threads="${FFMPEG_THREADS:-$(nproc)}"
  target_bytes="$((10 * 1024 * 1024))"
  target_bytes_eff="$(awk -v t="${target_bytes}" 'BEGIN{printf("%d\n",t*0.99)}')"
  aud_kbps=48
  max_overhead=0.05
  bpp_coef=0.06
  dur="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${file_name}")"
  dur_s="${dur%.*}"
  (( dur_s > 0 )) || dur_s=1

  progress_pb="$(mktemp)"
  probe_log="$(mktemp)"
  nohup "${CONV_PROGRESS}" "${progress_pb}" "${num}" "${oversized_count}" "🔎Probing..." \
    >/dev/null 2>&1 &
  pid_pb=$!
  t_sec="$(awk -v d="${dur:-0}" 'BEGIN{t=d*0.05;if(t<1.0)t=1.0;if(t>10.0)t=10.0;printf("%.2f\n",t)}')"
  mid_ss="$(awk -v d="${dur:-0}" -v t="${t_sec:-1}" 'BEGIN{ss=d/2.0-t/2.0;if(ss<0)ss=0;printf("%.2f\n",ss)}')"

  probe_status=0
  ffmpeg -y -v info \
    -ss "${mid_ss}" -t "${t_sec}" -i "${file_name}" \
    -c:v libx265 -preset ultrafast -b:v 500k -maxrate 500k -bufsize 1M \
    -c:a libopus -b:a "${aud_kbps}k" -vbr on -compression_level 10 -application audio \
    -movflags +faststart -map_metadata -1 -map_chapters -1 -dn \
    -f mp4 /dev/null 2>&1 |
    tee >(awk -f "${PROGRESS_AWK}" >> "${progress_pb}") \
        >(cat > "${probe_log}") > /dev/null || probe_status=$?
  kill -TERM "${pid_pb}" 2>/dev/null || true

  mux_ov_pct="$(awk '/muxing overhead:/{val=$NF;gsub(/%/,"",val);print val}' "${probe_log}")"
  if [[ -n "${mux_ov_pct}" ]]; then
    extra="$(awk -v d="${dur_s}" 'BEGIN{e=0.005+(60.0/d)*0.001;if(e>0.010)e=0.010;printf("%.4f\n",e)}')"
    overhead="$(awk -v m="${mux_ov_pct:-0}" -v ex="${extra}" -v mx="${max_overhead}" 'BEGIN{v=(m/100.0)+ex;if(v>mx)v=mx;if(v<0.0)v=0.0;printf("%.4f\n",v)}')"
  else
    overhead="${max_overhead}"
  fi
  rm -f -- "${progress_pb}" "${probe_log}"
  (( probe_status == 0 ))

  info="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,avg_frame_rate -of csv=s=x:p=0 "${file_name}")"
  IFS="x" read -r w h fps_raw <<< "${info}"
  fps="$(awk -v r="${fps_raw}" 'BEGIN{n=split(r,a,"/");if(n==2 && a[2]>0){printf("%.6f\n",a[1]/a[2])}else if(n==1){printf("%.6f\n",a[1]+0.0)}else{printf("0.000000\n")}}')"
  max_vbps_from_size="$(awk -v t="${target_bytes_eff}" -v oh="${overhead}" -v a="${aud_kbps}" -v d="${dur_s}" 'BEGIN{tb=t*8;ab=a*1000*d;usable=(tb*(1.0-oh))-ab;printf("%d\n",usable/d)}')"
  calc_min_vbps="$(awk -v w="${w}" -v h="${h}" -v f="${fps}" -v c="${bpp_coef}" 'BEGIN{v=w*h*f*c;printf("%d\n",v)}')"
  if (( h >= 1080 )); then
    fixed_min_vbps=1200000
  elif (( h >= 720 )); then
    fixed_min_vbps=800000
  elif (( h >= 480 )); then
    fixed_min_vbps=400000
  else
    fixed_min_vbps=250000
  fi
  tmp_min_vbps="$(( calc_min_vbps > fixed_min_vbps ? calc_min_vbps : fixed_min_vbps ))"
  if (( tmp_min_vbps > max_vbps_from_size )); then
    min_vbps="${max_vbps_from_size}"
  else
    min_vbps="${tmp_min_vbps}"
  fi
  Bv="${min_vbps}"

  progress_an="$(mktemp)"
  nohup "${CONV_PROGRESS}" "${progress_an}" "${num}" "${oversized_count}" "🧪Analyzing..." \
    >/dev/null 2>&1 &
  pid_an=$!
  mkdir -p "${WORKSPACE}/analyze"
  analyze_status=0
  ffmpeg -y \
    -i "${file_name}" \
    -threads "${threads}" \
    -c:v libx265 -preset ultrafast -b:v "${Bv}" -maxrate "${Bv}" -bufsize "$((Bv * 2))" \
    -an \
    -pass 1 -passlogfile "${WORKSPACE}/analyze/${file_name%.*}.log" \
    -f mp4 /dev/null 2>&1 |
    awk -f "${PROGRESS_AWK}" >> "${progress_an}" || analyze_status=$?
  kill -TERM "${pid_an}" 2>/dev/null || true
  rm -f -- "${progress_an}"
  (( analyze_status == 0 ))

  progress_cv="$(mktemp)"
  nohup "${CONV_PROGRESS}" "${progress_cv}" "${num}" "${oversized_count}" "🔁Converting..." \
    >/dev/null 2>&1 &
  pid_cv=$!
  mkdir -p "${WORKSPACE}/conv"
  convert_status=0
  ffmpeg -i "${file_name}" \
    -threads "${threads}" \
    -c:v libx265 -preset medium -b:v "${Bv}" -maxrate "${Bv}" -bufsize "$((Bv * 2))" \
    -pix_fmt yuv420p -tag:v hvc1 \
    -c:a libopus -b:a "${aud_kbps}k" -vbr on -compression_level 10 -application audio \
    -movflags +faststart -map_metadata -1 -map_chapters -1 -dn \
    -pass 2 -passlogfile "${WORKSPACE}/analyze/${file_name%.*}.log" \
    -fs 10MB \
    "${WORKSPACE}/conv/${file_name%.*}.mp4" 2>&1 |
    awk -f "${PROGRESS_AWK}" >> "${progress_cv}" || convert_status=$?
  sleep 2
  kill -TERM "${pid_cv}" 2>/dev/null || true
  rm -f -- "${progress_cv}"
  (( convert_status == 0 ))
done
