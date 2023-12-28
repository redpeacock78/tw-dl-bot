export const isEmptyObj = (obj: { [x: string]: string | File }) =>
  Object.keys(obj).length === 0;
