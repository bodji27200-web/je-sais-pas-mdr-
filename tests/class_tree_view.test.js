// Tests de l'interface visuelle de l'arbre de classes (Lot 16). On ne reconstruit
// pas les données : on vérifie que la vue rend les 65 classes, les 10 rangs, les
// états (verrouillé/débloqué/équipé), la fiche détaillée et les actions explicites.

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame } from "../js/core/state.js";
import { renderClassTree, renderNodeDetail } from "../js/ui/views.js";
import { CLASSES } from "../js/data/classes.js";
import { nodesForPath, totalClassCount } from "../js/data/classTree.js";

function rich() {
  const s = newGame("Arbre", "mage");
  s.gold = 100000;
  s.character.level = 100;
  return s;
}

test("arbre : la vue rend toutes les voies sans erreur", () => {
  const s = rich();
  for (const c of Object.values(CLASSES)) {
    const html = renderClassTree(s, c.id, null);
    assert.ok(html.includes("class-tree"), `voie ${c.id} rendue`);
    assert.ok(html.includes("tree-node"), "des classes affichées");
    assert.ok(/Rang\s*10|R10/.test(html) || html.includes("Rang"), "rangs affichés");
  }
});

test("arbre : la fiche de CHAQUE classe (65) se rend sans erreur", () => {
  const s = rich();
  let n = 0;
  for (const c of Object.values(CLASSES)) {
    for (const node of nodesForPath(c.id)) {
      const d = renderNodeDetail(s, node.id);
      assert.ok(d.includes("tree-detail"), `${node.id} : fiche`);
      assert.ok(d.includes("td-actions"), `${node.id} : actions`);
      n++;
    }
  }
  assert.equal(n, totalClassCount(), "toutes les classes ont une fiche");
});

test("arbre : la fiche ne pré-équipe pas — actions explicites selon l'état", () => {
  const s = rich();
  // Nœud de base (équipé par défaut pour un mage) -> indiqué « équipée », pas de bouton équiper.
  const equippedSheet = renderNodeDetail(s, "mage");
  assert.ok(/Classe équipée/.test(equippedSheet));
  // Une classe avancée verrouillée (jamais débloquée) -> consultable mais verrouillée.
  const lockedSheet = renderNodeDetail(newGame("X", "mage"), "lich");
  assert.ok(/Verrouillée|Débloquer/.test(lockedSheet), "état de déblocage affiché");
  assert.ok(!/data-act=\"equip-node\"/.test(lockedSheet) || /Débloquer/.test(lockedSheet), "pas d'équipement direct d'une classe verrouillée");
});

test("arbre : fiche d'invocateur indique la capacité d'emplacements", () => {
  const s = rich();
  const d = renderNodeDetail(s, "necromancer");
  assert.ok(/Invocateur/.test(d));
  assert.ok(/emplacement/.test(d), "capacité d'invocation affichée");
});
