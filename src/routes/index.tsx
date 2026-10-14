import { createFileRoute } from "@tanstack/react-router";
import { NowTimer } from "@/components/now-timer";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <NowTimer />;
}
