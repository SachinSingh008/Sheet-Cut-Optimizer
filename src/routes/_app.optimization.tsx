import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/optimization")({
  beforeLoad: () => {
    throw redirect({ to: "/layouts" });
  },
  component: () => null,
});
