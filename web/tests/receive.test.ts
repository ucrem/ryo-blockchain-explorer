import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { ReceiveResult } from "../src/lib/receive-verifier";

// These keys are intentionally public test scalars; containers are not signed
// consensus transactions. Native fixture generation supplies decoder oracles.
const fixtures = JSON.parse(readFileSync(new URL("./fixtures/receive.json", import.meta.url), "utf8"));
const assets = new URL("../public/crypto/", import.meta.url);
const ready = import(new URL("ryo-receive.mjs", assets).href).then(({ default: create }) => create({ print: () => {}, printErr: () => {} }));
async function local(request: unknown) {
  const verifier = await ready;
  const text = JSON.stringify(request), size = verifier.lengthBytesUTF8(text) + 1;
  const input = verifier._malloc(size);
  assert.ok(input);
  let output = 0;
  try {
    verifier.stringToUTF8(text, input, size);
    output = verifier._ryo_receive_request(input);
    assert.ok(output);
    return JSON.parse(verifier.UTF8ToString(output));
  } finally {
    verifier._ryo_wipe(input, size); verifier._free(input);
    if (output) { verifier._ryo_wipe(output, verifier.lengthBytesUTF8(verifier.UTF8ToString(output)) + 1); verifier._free(output); }
  }
}
test("bundled WASM and wrapper match their committed provenance hashes", () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", assets), "utf8"));
  for (const [file, hash] of Object.entries(manifest.assets_sha256))
    assert.equal(createHash("sha256").update(readFileSync(new URL(file, assets))).digest("hex"), hash);
  for (const [file, hash] of Object.entries(manifest.explorer_sources_sha256))
    assert.equal(createHash("sha256").update(readFileSync(new URL(`../../${file}`, import.meta.url))).digest("hex"), hash);
});
for (const fixture of fixtures) {
  test(`native/WASM parity: ${fixture.name}`, async () => {
    const result = await local(fixture.request);
    assert.deepEqual(result, fixture.expected);
    assert.ok(!JSON.stringify(result).includes(fixture.request.view_key ?? "synthetic-missing-key"));
    if (result.ok && fixture.request.action === "verify") {
      const data: ReceiveResult = result.data;
      assert.equal(data.outputs.reduce((total, output) => total + BigInt(output.amount_atomic), 0n).toString(), data.total_atomic);
    }
  });
}
test("native key validation happens without transaction bytes; bounded malformed input fails safely", async () => {
  const good = fixtures.find((fixture: { name: string }) => fixture.name === "v3-kind0").request;
  const { address, view_key } = good;
  assert.equal((await local({ action: "check", address, view_key })).ok, true);
  assert.equal((await local({ action: "check", address, view_key: "ff".repeat(32) })).error.code, "invalid_view_key");
  assert.equal((await local({ ...good, blob_hex: "0".repeat(8 * 1024 * 1024 + 8192) })).error.code, "resource_limit");
  assert.equal((await local({ action: "inspect", address: "not-an-address" })).error.code, "invalid_address");
});
