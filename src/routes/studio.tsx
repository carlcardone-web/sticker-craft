import { createFileRoute } from "@tanstack/react-router";
import { StudioLayout } from "@/components/studio/StudioLayout";

export const Route = createFileRoute("/studio")({
  component: StudioLayout,
});
