export const colors = {
  primary: "#f65050",
  action: "#f65050",
  darkSurface: "#1a1a1a",
  accentOrange: "#f38c4c",
  pink: "#ffe1e1",
  text: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  border: "#eeeeee",
  bg: "#f7f7f7",
  white: "#ffffff",
} as const;

export type ThemeColor = keyof typeof colors;
