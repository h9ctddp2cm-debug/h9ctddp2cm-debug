import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "index.html"), "utf8");

test("cooking is available only for FTHUE Level 6–7", () => {
  assert.match(source, /themeId !== 'cooking' \|\| level === '67'/);
  assert.match(source, /visibleThemeOrder\(\)\.forEach/);
  assert.match(source, /if\(!themeAvailableForLevel\('cooking'\)\)/);
});

test("every cooking instruction provides a top-right animated movement guide", () => {
  const cookBlock = source.match(/const COOK_STEPS = \[([\s\S]*?)\n\];/)?.[1] || "";
  const stepIds = [...cookBlock.matchAll(/\bid:'([^']+)'/g)].map(match => match[1]);
  const gifNames = [...cookBlock.matchAll(/\bmotionGif:'img\/advanced\/cook_motion\/([^']+)'/g)]
    .map(match => match[1]);

  assert.equal(stepIds.length, 12);
  assert.equal(gifNames.length, stepIds.length);
  stepIds.forEach((id) => {
    assert.ok(gifNames.includes(`${id}.gif`), `missing motion GIF for ${id}`);
    assert.ok(existsSync(path.join(root, "img", "advanced", "cook_motion", `${id}.gif`)));
  });

  assert.match(source, /id="cookMotionGuide"/);
  assert.match(source, /motionGuide\.classList\.add\('show'\)/);
  assert.match(source, /\.cook-motion-guide\{\s*position:absolute; top:248px; right:14px/);
});
