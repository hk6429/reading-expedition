import assert from "node:assert/strict";
import test from "node:test";

import { coreCharacters } from "../../src/data/character-catalog.js";

test("首波六名角色具備原創三特徵與無障礙資料", () => {
  assert.equal(coreCharacters.length, 6);
  assert.equal(new Set(coreCharacters.map(({ id }) => id)).size, 6);

  for (const character of coreCharacters) {
    assert.match(character.id, /^[a-z-]+$/);
    assert.ok(character.name.length >= 2);
    assert.ok(character.role.length >= 2);
    assert.ok(character.traits.clothing);
    assert.ok(character.traits.token);
    assert.ok(character.traits.pose);
    assert.match(character.asset, /^\.\/assets\/characters\/.+\.webp$/);
    assert.ok(character.alt.includes(character.name));
    assert.equal(character.proportion, "1:1");
  }
});

test("角色信物不使用血腥或傷害作為辨識特徵", () => {
  assert.doesNotMatch(
    JSON.stringify(coreCharacters),
    /血|傷口|斷頭|屍體|擊殺|處刑/,
  );
});
