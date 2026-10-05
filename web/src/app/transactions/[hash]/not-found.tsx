import { ResourceFailure } from "@/components/detail";
import { ApiError } from "@/lib/api";
export default function MissingTransaction() {
  return (
    <ResourceFailure
      kind="Transaction"
      error={new ApiError(404, "not_found", "Transaction not found.")}
    />
  );
}
