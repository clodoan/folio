const cmd = process.argv[2];
const rest = process.argv.slice(3);

async function run(mod: string) {
  process.argv = [process.argv[0], mod, ...rest];
  await import(mod);
}

if (cmd === "setup") await run("./folio-setup.ts");
else if (cmd === "now") await run("./folio-now.ts");
else if (cmd === "off") await run("./folio-off.ts");
else if (cmd === "letter") await run("./folio-letter.ts");
else if (cmd === "dusk") await run("./dusk.ts");
else {
  console.error("Usage: folio setup | now | off | letter | dusk");
  process.exit(1);
}
