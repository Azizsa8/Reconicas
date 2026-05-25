// Add Track — PRD-04. Server wrapper that reads plan quota and passes it to
// the client form. All interactive state (URL test scrape, debounced intent,
// cadence radio group) lives in <AddTrackForm /> in _form.tsx.
import { getSidebarCounts } from "@/lib/data/sidebar";
import { AddTrackForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function NewTrackPage() {
  const counts = await getSidebarCounts();
  return (
    <AddTrackForm
      planUsed={counts.tracks}
      planMax={counts.plan_max_tracks}
      planName={counts.plan_name}
    />
  );
}
