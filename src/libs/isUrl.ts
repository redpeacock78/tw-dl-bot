/**
 * Checks if a given string is a valid URL.
 *
 * @param {string} url - The URL to be checked.
 * @return {boolean} Returns true if the URL is valid, false otherwise.
 */
export const isUrl = (url: string): boolean => {
  if (url.match(/^https?:\/\/[\w/:@%#\$&\?\(\)~\.=\+\-]+$/) === null)
    return false;
  return URL.canParse(url);
};
