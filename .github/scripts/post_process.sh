#!/usr/bin/env bash
input="${1}"
vformat="$(ffprobe -v error -select_streams v:0 -show_entries format=format_name -of default=nk=1:nw=1 "${input}")"
vcodec="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nk=1:nw=1 "${input}")"
pix_fmt="$(ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt -of default=nk=1:nw=1 "${input}")"
if [[ "${vformat}" == "mov,mp4,m4a,3gp,3g2,mj2" ]]; then
  ext="${input##*.}"
else
  ext="mp4"
fi
tmp="${input%.*}.tmp.${ext}"
if [[ ${vformat} != "mov,mp4,m4a,3gp,3g2,mj2" || "${vcodec}" != "h264" || "${pix_fmt}" != "yuv420p" ]]; then
  ffmpeg -y \
    -i "${input}" \
    -threads "$(nproc)" \
    -preset veryfast \
    -c:v libx264 \
    -pix_fmt yuv420p \
    -c:a copy \
    -movflags +faststart \
    "${tmp}" && \
  rm -f "${input}" && \
  if [[ "${vformat}" == "mov,mp4,m4a,3gp,3g2,mj2" ]]; then
    mv "${tmp}" "${input}"
  else
    mv "${tmp}" "${input%.*}.${ext}"
  fi
fi
