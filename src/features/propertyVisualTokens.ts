import type { AnimatableProperty } from "@/editor/types/types";

export type PropertyVisualTokens = {
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentMuted: string;
  label: string;
};

export function getPropertyVisualTokens(
  property: AnimatableProperty
): PropertyVisualTokens {
  if (property === "position") {
    return {
      accent: "#6ba9df",
      accentSoft: "rgba(107, 169, 223, 0.14)",
      accentBorder: "rgba(107, 169, 223, 0.32)",
      accentMuted: "rgba(107, 169, 223, 0.62)",
      label: "#c9def2",
    };
  }

  if (property === "scale") {
    return {
      accent: "#7eca9d",
      accentSoft: "rgba(126, 202, 157, 0.14)",
      accentBorder: "rgba(126, 202, 157, 0.32)",
      accentMuted: "rgba(126, 202, 157, 0.62)",
      label: "#d4ecdd",
    };
  }

  if (property === "rotation") {
    return {
      accent: "#e3a56a",
      accentSoft: "rgba(227, 165, 106, 0.14)",
      accentBorder: "rgba(227, 165, 106, 0.32)",
      accentMuted: "rgba(227, 165, 106, 0.62)",
      label: "#f1dbc6",
    };
  }

  return {
    accent: "#bc92dd",
    accentSoft: "rgba(188, 146, 221, 0.14)",
    accentBorder: "rgba(188, 146, 221, 0.32)",
    accentMuted: "rgba(188, 146, 221, 0.62)",
    label: "#eadbf8",
  };
}
