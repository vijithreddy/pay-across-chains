import { loadRaceResult } from "@/lib/storage";
import { notFound } from "next/navigation";
import { SharedRaceView } from "@/components/shared-race-view";

/** Server component — loads race result and renders the shared view */
export default async function SharedRacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadRaceResult(id);

  if (!result) {
    notFound();
  }

  return <SharedRaceView result={result} />;
}
