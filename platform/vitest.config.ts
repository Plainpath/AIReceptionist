import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests share one database and truncate between cases.
    fileParallelism: false,
  },
});
