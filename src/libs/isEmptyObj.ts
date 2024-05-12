/**
 * Checks if an object is empty by verifying if it has any properties.
 *
 * @param {Object} obj - The object to be checked.
 * @return {boolean} Returns true if the object is empty, false otherwise.
 */
export const isEmptyObj = (obj: { [x: string]: string | File }): boolean =>
  Object.keys(obj).length === 0;
