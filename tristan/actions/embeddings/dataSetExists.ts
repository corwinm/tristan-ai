import { resolve } from "jsr:@std/path";
import { defaultEmbeddingsPath } from "./defaultDataPath.ts";

export function dataSetExists() {
  const info = Deno.lstatSync(resolve(defaultEmbeddingsPath));
  return info;
}
