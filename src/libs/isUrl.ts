export const isUrl = (url: string): boolean => {
  if (url.match(/^https?:\/\/[\w/:%#\$&\?\(\)~\.=\+\-]+$/) === null)
    return false;
  return URL.canParse(url);
};
