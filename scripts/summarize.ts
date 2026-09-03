import { dayInPT } from "../src/schema.ts";
import { writeDaySummary } from "./writeSummary.ts";

function main() {
  const arg = process.argv[2];
  const day =
    arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : dayInPT(new Date());
  const md = writeDaySummary(day);
  const n = md.split("\n").length;
  console.log(`Wrote data/summaries/${day}.md (${n} lines)`);
}

main();
