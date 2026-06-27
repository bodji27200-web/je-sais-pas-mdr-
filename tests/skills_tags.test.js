// Tests Lot 5 — compétences data-driven : tags d'IA (vocabulaire stable, dérivés
// des MÉCANIQUES et non du texte FR), références valides, éléments valides.

import { test } from "node:test";
import assert from "node:assert/strict";
import { SKILLS, getSkill, getSkillTags, deriveSkillTags, SKILL_TAGS } from "../js/data/skills.js";
import { CLASSES } from "../js/data/classes.js";
import { SPECIALIZATIONS } from "../js/data/specializations.js";
import { ENEMIES } from "../js/data/enemies.js";
import { ELEMENTS } from "../js/data/elements.js";

const ACTIVE = Object.values(SKILLS).filter((s) => s.type === "active");

test("chaque compétence active possède au moins un tag d'IA", () => {
  for (const s of ACTIVE) {
    const tags = getSkillTags(s.id);
    assert.ok(tags.length >= 1, `${s.id} doit avoir au moins un tag`);
    for (const t of tags) assert.ok(SKILL_TAGS.includes(t), `${s.id} : tag inconnu « ${t} »`);
  }
});

test("les tags reflètent les MÉCANIQUES (pas le texte) ", () => {
  for (const s of ACTIVE) {
    const tags = getSkillTags(s.id);
    if ((s.power || 0) > 0) assert.ok(tags.includes("damage"), `${s.id} inflige des dégâts -> tag damage`);
    if ((s.self || []).some((e) => e.type === "heal")) assert.ok(tags.includes("heal"), `${s.id} soigne -> tag heal`);
    if ((s.self || []).some((e) => ["shield", "def_buff", "guard", "guard_active", "guard_restore"].includes(e.type)))
      assert.ok(tags.includes("guard"), `${s.id} défensif -> tag guard`);
    if ((s.onHit || []).some((e) => e.type === "slow")) assert.ok(tags.includes("control"), `${s.id} ralentit -> tag control`);
    if (s.inflicts) assert.ok(tags.includes("debuff"), `${s.id} inflige un état -> tag debuff`);
  }
});

test("exemples concrets : Défendre=guard, Attaque=damage, Boule de feu=damage+debuff", () => {
  assert.deepEqual(getSkillTags("defend").sort(), ["guard"]);
  assert.ok(getSkillTags("basic_attack").includes("damage"));
  const fb = getSkillTags("fireball");
  assert.ok(fb.includes("damage") && fb.includes("debuff"), "Boule de feu = dégâts + Brûlure");
  assert.ok(getSkillTags("guard_breaker").includes("resource"), "conversion de Garde -> resource");
});

test("toutes les compétences référencées (classes, voies, ennemis) existent", () => {
  const refs = new Set();
  for (const c of Object.values(CLASSES)) { (c.skills || []).forEach((id) => refs.add(id)); if (c.passive) refs.add(c.passive); }
  for (const sp of Object.values(SPECIALIZATIONS)) { (sp.grants || []).forEach((id) => refs.add(id)); }
  for (const e of Object.values(ENEMIES)) { (e.skills || []).forEach((id) => refs.add(id)); if (e.passive) refs.add(e.passive); if (e.secondPassive) refs.add(e.secondPassive); }
  for (const id of refs) assert.ok(getSkill(id), `compétence référencée inconnue : ${id}`);
});

test("toute compétence à élément référence un élément valide (instr. 259)", () => {
  for (const s of Object.values(SKILLS)) {
    if (s.element) assert.ok(ELEMENTS[s.element], `${s.id} : élément inconnu ${s.element}`);
  }
});

test("deriveSkillTags est pur et tolère une compétence vide", () => {
  assert.deepEqual(deriveSkillTags(null), []);
  assert.deepEqual(deriveSkillTags({ power: 0 }), []);
  assert.deepEqual(deriveSkillTags({ power: 1 }), ["damage"]);
});
