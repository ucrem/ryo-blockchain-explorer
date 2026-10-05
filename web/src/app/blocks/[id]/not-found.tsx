import { ResourceFailure } from "@/components/detail";
import { ApiError } from "@/lib/api";
export default function MissingBlock() {
  return (
    <ResourceFailure
      kind="Block"
      error={new ApiError(404, "not_found", "Block not found.")}
    />
  );
}
