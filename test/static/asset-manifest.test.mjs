import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const manifest = JSON.parse(
  fs.readFileSync(new URL("../../assets/manifest.json", import.meta.url), "utf8"),
);

test("六名角色都有 48、96、192、512px 資產與 1:1 規格", () => {
  assert.equal(manifest.style.characterProportion, "1:1");
  assert.equal(Object.keys(manifest.characters).length, 6);
  for (const character of Object.values(manifest.characters)) {
    assert.deepEqual(Object.keys(character), ["48", "96", "192", "512"]);
    for (const asset of Object.values(character)) {
      const path = new URL(`../../assets/${asset.replace("./", "")}`, import.meta.url);
      assert.equal(fs.existsSync(path), true);
    }
  }
});

test("首頁與三航線圖片都有安全替代文字", () => {
  assert.ok(manifest.hero.alt.length > 10);
  assert.deepEqual(Object.keys(manifest.routes), ["world", "science", "humanities"]);
  for (const route of Object.values(manifest.routes)) {
    assert.ok(route.alt.length > 8);
  }
});
