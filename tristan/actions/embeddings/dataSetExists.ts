import { resolve } from "jsr:@std/path";
import { defaultEmbeddingsPath } from "./defaultDataPath.ts";

export function dataSetExists() {
  try {
    const info = Deno.lstatSync(resolve(defaultEmbeddingsPath));
    return info;
  } catch {
    return false;
  }
}
