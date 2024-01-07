const unitChangeForByte = (size: string, decimal = 2): string => {
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
