import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/studio/customize")({
  component: CustomizeRedirect,
});

function CustomizeRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/studio/create", replace: true });
  }, [navigate]);

  return null;
}
