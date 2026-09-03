/** 0.45mm round felt-tip. Stamp or round-cap stroke along the motor trajectory. */
export const FELT = {
  diameterMm: 0.45,
  ink: "#2A5F9E",
  paper: "#F3EBDC",
};
export function feltWidthMm(scale = 1) { return FELT.diameterMm * scale; }
