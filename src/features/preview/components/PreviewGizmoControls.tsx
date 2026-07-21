import type { ComponentProps } from "react";
import PreviewAnchorControl from "@/features/preview/components/PreviewAnchorControl";
import PreviewGizmoHandles from "@/features/preview/components/PreviewGizmoHandles";
import PreviewGizmoReadouts from "@/features/preview/components/PreviewGizmoReadouts";

type PreviewGizmoControlsProps = {
  handlesProps: ComponentProps<typeof PreviewGizmoHandles>;
  readoutsProps: ComponentProps<typeof PreviewGizmoReadouts>;
  anchorProps: ComponentProps<typeof PreviewAnchorControl>;
};

export default function PreviewGizmoControls({
  handlesProps,
  readoutsProps,
  anchorProps,
}: PreviewGizmoControlsProps) {
  return (
    <>
      <PreviewGizmoHandles {...handlesProps} />
      <PreviewAnchorControl {...anchorProps} />
      <PreviewGizmoReadouts {...readoutsProps} />
    </>
  );
}
