# Illustrations (assets)

Le jeu fonctionne **sans aucune image** : tant qu'un fichier est absent, un emoji
de secours s'affiche dans le médaillon. Dès qu'une image est déposée au bon
chemin, elle recouvre automatiquement l'emoji (aucun code à modifier).

Format conseillé : **PNG carré opaque** (ex. 256×256 ou 512×512), fond intégré,
style cohérent dark fantasy.

## Chemins attendus

### Classes — `assets/classes/`
- `warrior.png` · `guardian.png` · `archer.png` · `mage.png` · `assassin.png`

### Métiers — `assets/jobs/`
- `woodcutting.png` · `mining.png`

### Zones — `assets/zones/`
- `whispering_forest.png`

### Ressources — `assets/resources/`
- `soft_wood.png` · `oak_wood.png` · `stone.png` · `copper_ore.png`
- `iron_ore.png` · `rough_gem.png` · `copper_ingot.png` · `iron_ingot.png`
- `raw_hide.png` · `coarse_cloth.png`

### Équipements — `assets/equipment/`
- `copper_sword.png` · `iron_sword.png` · `iron_greatsword.png`
- `cloth_hood.png` · `cloth_robe.png`
- `leather_cap.png` · `leather_armor.png` · `leather_boots.png`
- `iron_helm.png` · `iron_plate.png` · `iron_greaves.png`
- `gem_amulet.png`

### Ennemis & boss — `assets/enemies/`
- `feral_wolf.png` · `goblin_raider.png` · `wild_boar.png`
- `forest_bandit.png` · `goblin_chief_grok.png`

> Les chemins exacts sont définis dans les fichiers `js/data/*.js` (champ `image`).
