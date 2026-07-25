export type EditorPlaceholderDescriptor = {
  readonly placeholderKind: "drawing" | "text" | "audio";
  readonly label: string | null;
  readonly fill: string;
  readonly textColor: string;
  readonly size: { readonly width: number; readonly height: number };
};
