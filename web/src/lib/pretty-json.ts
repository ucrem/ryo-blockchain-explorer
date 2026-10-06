// JSON layout only: original string, number and literal tokens are never decoded.
export class JsonPreviewLimit extends Error {}
const MAX_INPUT = 1024 * 1024;
const MAX_OUTPUT = 4 * 1024 * 1024;
const MAX_DEPTH = 64;
type Frame = {
  type: "object" | "array";
  state: "keyOrEnd" | "key" | "colon" | "value" | "valueOrEnd" | "commaOrEnd";
};
export function prettyJson(text: string): string {
  if (text.length > MAX_INPUT)
    throw new JsonPreviewLimit("Response exceeds formatted preview size.");
  const frames: Frame[] = [];
  const chunks: string[] = [];
  let i = 0,
    size = 0,
    started = false;
  function invalid(): never {
    throw new SyntaxError("Invalid JSON response.");
  }
  const write = (s: string) => {
    size += s.length;
    if (size > MAX_OUTPUT)
      throw new JsonPreviewLimit("Formatted response exceeds preview size.");
    chunks.push(s);
  };
  const line = (depth: number) => write(`\n${"  ".repeat(depth)}`);
  const stringToken = () => {
    const start = i++;
    while (i < text.length) {
      const c = text[i++];
      if (c === '"') return text.slice(start, i);
      if (c === "\\") {
        const escape = text[i++];
        if (escape === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i, i + 4))) invalid();
          i += 4;
        } else if (!escape || !'"\\/bfnrt'.includes(escape)) invalid();
      } else if (c.charCodeAt(0) < 32) invalid();
    }
    return invalid();
  };
  const number = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
  while (i < text.length) {
    if (/[ \t\n\r]/.test(text[i])) {
      i++;
      continue;
    }
    const c = text[i],
      frame = frames.at(-1);
    if (c === "}" || c === "]") {
      if (
        !frame ||
        (c === "}" ? frame.type !== "object" : frame.type !== "array")
      )
        invalid();
      if (
        frame.state !== "commaOrEnd" &&
        frame.state !== "keyOrEnd" &&
        frame.state !== "valueOrEnd"
      )
        invalid();
      if (frame.state === "commaOrEnd") line(frames.length - 1);
      frames.pop();
      write(c);
      i++;
      continue;
    }
    if (c === ",") {
      if (!frame || frame.state !== "commaOrEnd") invalid();
      frame.state = frame.type === "object" ? "key" : "value";
      write(",");
      line(frames.length);
      i++;
      continue;
    }
    if (c === ":") {
      if (!frame || frame.state !== "colon") invalid();
      frame.state = "value";
      write(": ");
      i++;
      continue;
    }
    if (
      frame?.type === "object" &&
      (frame.state === "keyOrEnd" || frame.state === "key")
    ) {
      if (c !== '"') invalid();
      if (frame.state === "keyOrEnd") line(frames.length);
      write(stringToken());
      frame.state = "colon";
      continue;
    }
    if (frame) {
      if (frame.state !== "value" && frame.state !== "valueOrEnd") invalid();
      if (frame.state === "valueOrEnd") line(frames.length);
      frame.state = "commaOrEnd";
    } else {
      if (started) invalid();
      started = true;
    }
    if (c === "{" || c === "[") {
      if (frames.length >= MAX_DEPTH)
        throw new JsonPreviewLimit("Response exceeds formatted preview depth.");
      frames.push(
        c === "{"
          ? { type: "object", state: "keyOrEnd" }
          : { type: "array", state: "valueOrEnd" },
      );
      write(c);
      i++;
    } else if (c === '"') write(stringToken());
    else if (c === "-" || /[0-9]/.test(c)) {
      number.lastIndex = i;
      const token = number.exec(text)?.[0];
      if (!token) invalid();
      write(token);
      i += token.length;
    } else {
      const token = ["true", "false", "null"].find((value) =>
        text.startsWith(value, i),
      );
      if (!token) invalid();
      write(token);
      i += token.length;
    }
  }
  if (!started || frames.length) invalid();
  return chunks.join("");
}

export function jsonViewHref(apiPath: string): string {
  if (!apiPath.startsWith("/api/v2/"))
    throw new Error("Expected a public API path.");
  return `/json/${apiPath.slice("/api/v2/".length)}`;
}
