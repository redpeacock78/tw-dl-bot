/**
 * Converts a size in bytes to a human-readable format with the specified number of decimal places.
 *
 * @param {string} size - The size in bytes to be converted.
 * @param {number} [decimal=2] - The number of decimal places to round the converted size to. Defaults to 2.
 * @return {string} - The converted size in a human-readable format.
 */
const unitChangeForByte = (size: string, decimal: number = 2): string => {
  /**
   * Returns the target number and unit for converting a size in bytes to a human-readable format.
   *
   * @param {string} size - The size in bytes to be converted.
   * @return {{target: number | null, unit: string}} - An object containing the target number and unit.
   */
  const getTarget = (
    size: string
  ): {
    target: number | null;
    unit: string;
  } => {
    const kb = 1024;
    const mb: number = Math.pow(kb, 2);
    const gb: number = Math.pow(kb, 3);
    const tb: number = Math.pow(kb, 4);
    if (Number(size) >= tb) return { target: tb, unit: "TB" };
    if (Number(size) >= gb) return { target: gb, unit: "GB" };
    if (Number(size) >= mb) return { target: mb, unit: "MB" };
    if (Number(size) >= kb) return { target: kb, unit: "KB" };
    return { target: null, unit: "byte" };
  };

  const { target, unit } = getTarget(size);
  const d: number = Math.pow(10, decimal);
  return target !== null
    ? `${Math.floor((Number(size) / target) * d) / d}${unit}`
    : `${size}${unit}`;
};

export default unitChangeForByte;
