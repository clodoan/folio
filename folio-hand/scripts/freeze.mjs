import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { freezeGlyphs, coveredLetters } from "../src/glyphs.js";

const dir = dirname(fileURLToPath(import.meta.url));
const recipes = freezeGlyphs();
const dest = join(dir, "..", "recipes-cursive-v1.json");
writeFileSync(dest, JSON.stringify(recipes, null, 2));
console.log("froze", dest, "letters", coveredLetters().join(""), "id", recipes.id, recipes.engine);
