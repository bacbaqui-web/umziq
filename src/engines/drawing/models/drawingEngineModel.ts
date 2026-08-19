import type { PointerEvent } from "react";
import type { PlainDataObject } from "@/models";

export type DrawingTool = "brush" | "eraser" | "fill";

export interface DrawingEngineViewProps {
  readonly canEnableMode: boolean;
  readonly modeEnabled: boolean;
  readonly tool: DrawingTool;
  readonly color: string;
  readonly size: number;
  readonly draftPoints: readonly { x: number; y: number }[];
  readonly toggleMode: () => void;
  readonly setTool: (tool: DrawingTool) => void;
  readonly setColor: (color: string) => void;
  readonly setSize: (size: number) => void;
  readonly pointerDown: (event: PointerEvent<SVGSVGElement>) => void;
  readonly pointerMove: (event: PointerEvent<SVGSVGElement>) => void;
  readonly pointerUp: (event: PointerEvent<SVGSVGElement>) => void;
  readonly pointerCancel: () => void;
  readonly elements: readonly PlainDataObject[];
  readonly geometry: {
    readonly width: number; readonly height: number;
    readonly position: { x: number; y: number };
    readonly anchor: { x: number; y: number };
    readonly scale: { x: number; y: number };
    readonly rotation: number;
  } | null;
}
