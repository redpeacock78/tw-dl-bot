FROM ubuntu:latest

RUN apt-get update && \
  apt-get install -y ffmpeg gawk curl jq && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* && \
  stable_url="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" && \
  nightly_url="https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp" && \
  curl -sL \
    --retry 100 \
    --retry-all-errors \
    -o /usr/local/bin/yt-dlp \
    "${stable_url}" && \
  chmod a+rx /usr/local/bin/yt-dlp && \
  version="$(curl -sI -m 18000 --retry 100 --retry-all-errors "${nightly_url}" | grep 'location: ' | awk -F '/' '{print $8}')" && \
  yt-dlp --update-to "nightly@${version}"

WORKDIR /app
