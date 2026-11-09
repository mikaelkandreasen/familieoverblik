// Forvalgene til farvetemaer (Standard, Varm, Mørk, Høj kontrast). Bruges af forsiden til at vælge et tema på den enkelte enhed.
// SKAL være ens med TEMA_STD og TEMA_PRESETS i index.html (en prøve sammenligner dem).
export const TEMA_STD = { "--paper": "#fbfaf6", "--card": "#ffffff", "--card-weekend": "#f4f2ee", "--ink": "#14201c", "--ink-soft": "#505a54", "--ink-faint": "#5e6c6c",
  "--rule": "#16302b", "--rule-soft": "#dfdcd2", "--panel": "#12302c", "--panel-ink": "#f2f0e9", "--panel-soft": "#9fb3ae", "--panel-rule": "#2c4b46",
  "--tint-blue": "#e4f1f6", "--tint-pink": "#fbe7e2", "--tint-yellow": "#fbf2d9", "--accent": "#a45238",
  "--p-1": "#52616d", "--p-2": "#784078", "--p-3": "#173e6e", "--p-4": "#1a5929", "--p-5": "#92561a",
  "--p-6": "#8a2b4a", "--p-7": "#0f6b6b", "--p-8": "#7a5c00", "--p-9": "#4b3f8f", "--p-10": "#a33b20", "--p-11": "#3d6b00", "--p-12": "#6b4a2e" };
export const TEMA_PRESETS = {
  "Standard": TEMA_STD,
  "Varm": { ...TEMA_STD, "--paper": "#f7f1e6", "--card": "#fffdf8", "--card-weekend": "#f2eadb", "--ink": "#2b1d12", "--ink-soft": "#5a4636", "--ink-faint": "#6a5646",
    "--rule": "#3a2a1c", "--rule-soft": "#e3d7c3", "--panel": "#4a2e1b", "--panel-ink": "#fbf3e6", "--panel-soft": "#dcc3a8", "--panel-rule": "#6a4a32",
    "--tint-blue": "#e6eef2", "--tint-pink": "#f8e3da", "--tint-yellow": "#faedc8", "--accent": "#a8481f",
    "--p-1": "#55616b", "--p-2": "#7a3f78", "--p-3": "#1b3f6c", "--p-4": "#1d5a2c", "--p-5": "#8d4f12",
    "--p-6": "#8c2f4c", "--p-7": "#135f5f", "--p-8": "#7a5a0a", "--p-9": "#50428a", "--p-10": "#9e3b1e", "--p-11": "#3f6a0c", "--p-12": "#6e4b2c" },
  "Mørk": { ...TEMA_STD, "--paper": "#10161b", "--card": "#1a222a", "--card-weekend": "#161d24", "--ink": "#e8ecef", "--ink-soft": "#aab5be", "--ink-faint": "#94a1ac",
    "--rule": "#4a5866", "--rule-soft": "#26313b", "--panel": "#26323d", "--panel-ink": "#eef2f5", "--panel-soft": "#a9b5bf", "--panel-rule": "#3d4b59",
    "--tint-blue": "#17323d", "--tint-pink": "#3a2428", "--tint-yellow": "#3a3420", "--accent": "#e8946f",
    "--p-1": "#a9b8c4", "--p-2": "#cf9fcf", "--p-3": "#86ade6", "--p-4": "#6fcf8a", "--p-5": "#e3a96f",
    "--p-6": "#e49ab5", "--p-7": "#6fd0d0", "--p-8": "#e2c25b", "--p-9": "#a99ce8", "--p-10": "#f0a58a", "--p-11": "#afcb6b", "--p-12": "#cba98a" },
  "Høj kontrast": { ...TEMA_STD, "--paper": "#ffffff", "--card": "#ffffff", "--card-weekend": "#f2f2f2", "--ink": "#000000", "--ink-soft": "#1f1f1f", "--ink-faint": "#333333",
    "--rule": "#000000", "--rule-soft": "#8a8a8a", "--panel": "#000000", "--panel-ink": "#ffffff", "--panel-soft": "#e6e6e6", "--panel-rule": "#666666",
    "--tint-blue": "#dcecff", "--tint-pink": "#ffe0e0", "--tint-yellow": "#fff3b8", "--accent": "#8a2b00",
    "--p-1": "#2f3d49", "--p-2": "#5a1d5a", "--p-3": "#0a2c60", "--p-4": "#0b4418", "--p-5": "#6a3a00",
    "--p-6": "#6a1a38", "--p-7": "#064545", "--p-8": "#5a4200", "--p-9": "#32286b", "--p-10": "#7a2610", "--p-11": "#2a4a00", "--p-12": "#4a3018" },
};