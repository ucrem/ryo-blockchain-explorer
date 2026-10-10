// Only native Ryo performs address validation and output/amount interpretation.
// This disposable worker has no API requests or persistent storage.
import createVerifier from "./ryo-receive.mjs";

self.onmessage = async ({ data }) => {
  let verifier, input = 0, output = 0, inputSize = 0, outputSize = 0;
  try {
    verifier = await createVerifier({ print: () => {}, printErr: () => {} });
    let request = JSON.stringify(data);
    data = null;
    inputSize = verifier.lengthBytesUTF8(request) + 1;
    if (inputSize > 8 * 1024 * 1024 + 4097) throw new Error();
    input = verifier._malloc(inputSize);
    if (!input) throw new Error();
    verifier.stringToUTF8(request, input, inputSize);
    request = "";
    output = verifier._ryo_receive_request(input);
    if (!output) throw new Error();
    const result = verifier.UTF8ToString(output);
    outputSize = verifier.lengthBytesUTF8(result) + 1;
    self.postMessage(JSON.parse(result));
  } catch {
    self.postMessage({ ok: false, error: { code: "local_failure", message: "Local Ryo verification failed or is unavailable in this browser. No server fallback is used." } });
  } finally {
    if (verifier && input) { verifier._ryo_wipe(input, inputSize); verifier._free(input); }
    if (verifier && output && outputSize) { verifier._ryo_wipe(output, outputSize); verifier._free(output); }
    self.close();
  }
};
