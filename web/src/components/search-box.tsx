import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SearchBox() {
  return (
    <form action="/search" method="get" role="search" className="chain-search">
      <label htmlFor="chain-query">Search the Ryo blockchain</label>
      <div className="search-controls">
        <input
          id="chain-query"
          name="q"
          type="text"
          required
          maxLength={64}
          placeholder="Block height, block hash or transaction hash"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby="search-help"
        />
        <Button type="submit">
          <Search aria-hidden="true" />
          Search
        </Button>
      </div>
      <p id="search-help">
        Enter a block height or a public 64-character hash.
      </p>
    </form>
  );
}
