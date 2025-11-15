---
name: Hausbau v2 — Eingelassenes Fundament, Säulenlauf, Außentreppe
description: "Verwenden, wenn der Bot ein rechteckiges Haus mit eingelassenem Fundament bauen soll: Wände spaltenweise hochziehen, indem er auf der letzten Säule steht (\"Säulenlauf\", wie reale Spieler). Temporäre Außentreppe für Zugang, strikte Reichweiten‑/Belegungsregeln. Geeignet für Größen ~4–10 Blöcke Seitenlänge. Voraussetzung: freier Bauplatz + Material (Boden/Wand/Treppe) im Inventar."
allowed-tools: place_block, use_item_on_block, move_to_position, look_at, dig_block, equip_item, craft_item, find_block, find_entity, get_position, list_inventory
---

# SKILL: house_building_v2

**Ziel:** Ein rechteckiges Minecraft‑Haus bauen, mit **eingelassenem Fundament**, **Wände spaltenweise aufmauern** (der Bot läuft auf den fertigen Säulen, wie beim „Säulenlauf“) und **temporären Außentreppen**, um später wieder hochzukommen.

**Notation:** Weltkoordinaten (x, y, z) mit optionalen relativen Schritten (dx, dy, dz) entlang des Perimeters. Alle Positionsangaben sind absolute Minecraft‑Koordinaten.

**Parameter:**

* `width` (X/F‑Richtung), `length` (Z/R‑Richtung), `wall_height` (≥3),
* `floor_block`, `wall_block`, `stair_block` (für Hilfstreppe), `torch_cadence`.

---

## 0) Sicherheits‑ und Reichweitenregeln (hart erzwungen)

* **REACHABLE_PLACE[target]**: `DIST(feet, target) ≤ 3.5` Blöcke **UND** `target ≠ (0,0,0)` (Bot darf **nicht** auf dem Zielblock stehen).
* **Kopffreiheit beim Hochgehen**: Vor einem vertikalen Schritt verifizieren, dass an (x, y+1, z) und (x, y+2, z) Luft ist; sonst Zwischenstufe setzen.
* **CAN_STAND[x]** bevor dorthin bewegt wird.
* **Kein Platzieren in Spieler‑Hitbox**: nie `PLACE @ (0,0,0)` oder `PLACE @ U0`.
* **Kein Graben über Kopf von GRAVITY** (`SAND/GRAVEL`) ohne Top‑Down‑Mitigation.
* **Flüssigkeiten sichern**: Lava/Wasser im Fundament zuerst füllen/ableiten.

> Diese Checks laufen in jedem MOVE/DIG/PLACE; sonst Abbruch mit Grund.

---

## 1) Phasenübersicht

1. **Vermessen & Plan**
2. **Ausheben (in Boden einlassen)**
3. **Fundament legen (Boden und Ring)**
4. **Wände spaltenweise hochziehen (Säulenlauf auf der Wandkrone)**
5. **Temporäre Außentreppe** anbringen (für späteren Zugang)
6. **Innenboden / Decke / Dach (optional)**
7. **Aufräumen** (temporäres raus)

---

## 2) Kern‑Prädikate & Hilfen (in Weltkoordinaten)

* `RECT(p0, width, length)` — Rechteck vom **Start‑Eckpunkt** `p0=(x0,y0,z0)`.
* `PERIMETER(rect)` — Randpositionen (Bodenkoordinaten) im Uhrzeigersinn: inkrementiere x bzw. z in ganzen Schritten.
* `LAYER(y)` — alle Positionen der Schicht `y` relativ zu `p0.y` (also bei `y = p0.y + k`).
* `SAFE_DIG[t]` — kein GRAVITY darüber / falls doch → erst von oben lösen.
* `SAFE_PLACE[t]` — Block an (x,y,z) ist Luft und innerhalb Reichweite; andernfalls zuerst Hilfsblock setzen oder näher heran navigieren.
* `WALLTOP(y)` — Wandkronen‑Zielkoordinaten der aktuellen Schicht (x/z unverändert, y = p0.y + Schichthöhe).

---

## 3) Makro‑Bausteine (x/y/z‑Stil)

> Syntax bewusst knapp gehalten; Kommentare mit `#`.

### 3.1 Ausheben (einlassen)

Ziel: **eine Ebene tiefer** als natürliche Oberfläche, damit das Fundament **unter** den Füßen liegt.

```
MACRO EXCAVATE_RECT(p0, width, length) {
  # Abtrag bis y = ground_level - 1 im Rechteck
  FOR each cell c IN RECT(p0,width,length) {
    WHILE BLOCK[c] != AIR {
      ASSERT SAFE_DIG[c];
      DIG c;
    }
  }
}

# Freiformvariante mit expliziten Koordinaten (x/z-Bereiche + Zielhöhe)
**CraftScript-Funktion `excavate_range(name, from_x, to_x, from_z, to_z, target_y)`**

> Persistente `craftscript_function` im Colony-DB-Cache (jetzt registriert): läuft spaltenweise durch den Bereich, `goto`’t jede Säule und bricht Blöcke von oben nach unten bis `target_y`. `break()` bringt automatisch den SAFE_DIG-Effekt (Sand/Gravel-Warnung), hinzu kommen Logs `excavate_range:start|column|done` für das angegebene `name`.

* `name` – freies Label für Log/Diagnose (default: `"excavate_range"`).
* `from_x` / `to_x` – Grenzen in X (Reihenfolge egal, der Helper sortiert sie).
* `from_z` / `to_z` – Grenzen in Z.
* `target_y` – Absolute Tiefe, bis wohin jede Säule abgetragen wird.

**Aufruf im CraftScript:**

```
excavate_range(
  name: "fundament-west",
  from_x: base_x,
  to_x: base_x + width - 1,
  from_z: base_z,
  to_z: base_z + length - 1,
  target_y: base_y - 1
);
```

Der Helper parkt den Bot knapp oberhalb jeder Säule (`goto(x, stand_y, z, tol:1)`) und läuft dann Block für Block nach unten. Damit entfällt das manuelle Makro und die Aushebung bleibt konsistent dokumentiert.

### 3.2 Fundament (Boden + Ring)

Ziel: Tragfähiger Boden **in der Grube**, bündig mit dem umliegenden Terrain (Top des Fundaments = altes Bodenniveau).

```
MACRO LAY_FOUNDATION(p0, width, length, floor_block) {
  # Fläche
  FOR each cell c IN RECT(p0,width,length) {
    IF SAFE_PLACE[c] { PLACE floor_block @ c; }
  }
  # Optional: Ring unter der späteren Wand (zusätzliche Stabilität)
  FOR each rim r IN PERIMETER(RECT(p0,width,length)) {
    IF SAFE_PLACE[r] { PLACE floor_block @ r; }
  }
}
```

### 3.3 Fundament ausheben & verfüllen

1. **EXCAVATE_RECT(p0,width,length)** bis `y = surface - 1`.
2. **FILL** jede Zelle mit dem gewünschten Fundamentblock (`floor_block`) bevor du irgendetwas platzierst oder auf den Seiten läufst. Nur so haben spätere `place()`-Kommandos eine feste Referenz.
3. Wenn der Untergrund aus Sand/Gravel besteht, fülle erst mit günstigen Blöcken und setze darauf den sichtbaren Terrakotta-Fußboden.

### 3.4 Säulenweise Hochmauern (Säulenlauf)

**Prinzip:**
1. Nur die **erste Säule** wird mit `build_up()` hochgezogen, damit du einmal auf Wandhöhe kommst.
2. Danach bleibst du stets auf der fertigen Säule stehen und setzt die nächste Säule **komplett per `place` von oben**: Jede Platzierung klickt die Seitenfläche unter deinen Füßen an, sodass du Block für Block von unten nach oben stapeln kannst, ohne abzusteigen.
3. Sobald Säule *i+1* fertig ist, springst/läufst du oben hinüber und wiederholst den Vorgang für *i+2*.
4. Fenster/Türen sägst du zum Schluss mit `break()` in die fertig geschlossene Wand.

```
MACRO BUILD_WALLS_COLUMNAR(p0, width, length, wall_block, wall_height, torch_cadence) {
  step := 0;
  rimPositions := PERIMETER(RECT(p0,width,length));

  base0 := rimPositions[0];
  BUILD_COLUMN_AT(base0, wall_block, wall_height);
  STAND_ON_TOP(base0, wall_height);

  for idx in 1..rimPositions.length-1 {
    base := rimPositions[idx];

    h := 0;
    WHILE h < wall_height {
      target := (base.x, p0.y + h + 1, base.z);
      IF SAFE_PLACE[target] { PLACE wall_block @ target; }
      h := h + 1;
    }

    MOVE world(base.x, p0.y + wall_height, base.z);

    step := step + 1;
    IF (step % torch_cadence == 0) {
      outer := OUTER_FACE_OF_WALL((base.x, p0.y + wall_height - 1, base.z));
      IF SAFE_PLACE[outer] { PLACE TORCH @ outer; }
    }
  }
}

MACRO BUILD_COLUMN_AT(base, wall_block, wall_height) {
  h := 0;
  WHILE h < wall_height {
    target := (base.x, base.y + h + 1, base.z);
    IF SAFE_PLACE[target] { PLACE wall_block @ target; }
    h := h + 1;
  }
}

MACRO STAND_ON_TOP(base, height) {
  MOVE world(base.x, base.y + height, base.z);
}
```

> Ergebnis: Der Bot verlässt die Wandkrone nie, behält seine Referenzblöcke direkt vor sich und kann jede neue Säule im „Vorbeigehen“ hochziehen.

### 3.4 Temporäre Außentreppe (externe Zugangstreppe)

Ziel: später **wieder hoch** auf die Wandkrone kommen (z. B. zum Dach).

```
MACRO EXT_TEMP_STAIR(outside_anchor, height, stair_block) {
  # outside_anchor = Weltposition direkt außerhalb der Außenwand auf Bodenniveau
  h := 0;
  WHILE h < height {
    tread := (outside_anchor.x + h*dx, outside_anchor.y + h, outside_anchor.z + h*dz);   # 45° Treppe: vor + hoch
    IF SAFE_PLACE[tread] { PLACE stair_block @ tread; }
    h := h + 1;
  }
}
```

### 3.5 Aufräumen (Temporär entfernen)

```
MACRO CLEAR_TEMP_STAIR(outside_anchor, height) {
  h := height - 1;
  WHILE h >= 0 {
    tread := outside_anchor + F(h) + U(h);
    IF BLOCK[tread] != AIR { DIG tread; }
    h := h - 1;
  }
}
```

---

### 3.6 Dachplatten von oben setzen (seitliches Anklicken)

Bei Flachdächern oder einfachen Decken gilt: **Bleib auf dem zuletzt gesetzten Dachblock stehen** und setze den nächsten Block, indem du die Seitenfläche deines Standblocks anklickst. Mineflayer erlaubt so frei schwebende Platzierungen – genauso wie ein Spieler, der ein Dach „über den Abgrund“ erweitert.

**Workflow:**
1. Starte an einer Kante. `place(roof_block, current.x + dx, current.y, current.z + dz)` während du auf `(current.x, current.y, current.z)` stehst. Der Referenzklick erfolgt automatisch auf der Seitenfläche unter den Füßen.
2. `move` auf den neuen Block, wiederhole Schritt 1. Damit liegt immer ein Referenzblock hinter dir.
3. Für Innenflächen: zuerst einen Rand schließen, dann diagonal Bahn für Bahn ausfüllen – stets auf dem zuletzt gesetzten Block stehen bleiben.
4. **Keine Diagonalen:** Du brauchst immer eine Nord/Süd/Ost/West-Seitenfläche. Gibt es nur Luft diagonal, schlägt `place` mit `invalid_face` fehl – vorher einen Block unterhalb setzen oder eine Stütze bauen.
5. Muss die Höhe wechseln (z. B. Dachstufe): erst `build_up()` oder `step_down()` an der gewünschten Stelle, danach wie oben weitermachen.

So braucht es keine Hilfsstützen mehr; du nutzt exakt die Technik, mit der echte Spieler Dachflächen bauen.

---

## 4) Intent → Plan (Beispielprogramm)

**Intent:** `BUILD_HOUSE` mit `{ width:7, length:9, wall_height:3, floor_block:COBBLE, wall_block:OAK_PLANKS, stair_block:COBBLE, torch_cadence:7 }`.

**Kompilierter Plan (x/y/z‑Skizze):**

```
# 1) Vermessen
MARK start_corner;

# 2) Ausheben
EXCAVATE_RECT(start_corner, 7, 9);

# 3) Fundament planieren (einfüllen)
LAY_FOUNDATION(start_corner, 7, 9, COBBLESTONE)  # fülle die Aushebung, damit spätere place-Kommandos eine Referenz haben.

# 4) Wände schichtweise mitlaufen
BUILD_WALLS_COLUMNAR(start_corner, 7, 9, OAK_PLANKS, 3, 7);

# 5) Temporäre Außentreppe an der Südwand (Beispiel)
TURN FACE S;
anchor := (start.x + dx, start.y, start.z + dz);   # 1 Block außerhalb der Südwand in Laufrichtung
EXT_TEMP_STAIR(anchor, 3, COBBLESTONE);

# (optional) Dach / Decke …

# 6) Aufräumen
CLEAR_TEMP_STAIR(anchor, 3);
```

---

## 5) Reichweiten‑ & Belegungslogik (konkret)

* **Beim Setzen** gilt:
  `REACHABLE_PLACE[target] := DIST(feet, target) ≤ 3.5` **UND** `target != (0,0,0)`
  → Wenn zu weit weg: **erst hinlaufen** (`GOTO @ target within=2`), dann setzen.
* **Beim Graben** ähnlich: `DIST(feet, block) ≤ 4.5` und keine GRAVITY‑Gefahr über Kopf; sonst **von oben** öffnen oder seitlich annähern.
* **Keine Selbstblockade**: vor `PLACE` verifizieren, dass **Weg zurück** existiert (kein Einsperren).

Für die **Mauer‑Kante**:

* Bewegung **auf der Krone**: gehe per Perimeter‑Schritt (dx, dz) weiter; wenn ein Stufensprung nötig ist, erhöhe y um +1.
* Jede Ecke: prüfen, ob `CAN_STAND[next_corner]`; wenn nicht, kleine Zwischenstufe setzen (`PLACE wall_block @ (x+dx, y, z+dz); MOVE (x+dx, y, z+dz)`) und danach wieder entfernen.

---

## 6) Praktische Hinweise & Fallbacks

* **Differenz‑Terrain**: Ist das Rechteck uneben, nivelliere zuerst:
  `FILL LOWS` (mit Bodenblöcken) → `CUT HIGHS` (EXCAVATE), bis alle Zellen `y = ground - 1` erreichen.
* **Wasser/Lava im Baufeld**:
  * Wasser: Eimer oder Blockfüllung, bis **AIR**/traversierbar.
  * Lava: **Stein** (oder Schüttung) platziert, bis keine Quelle mehr benachbart ist.
* **Materialprüfung vor Start** (aus `plan_summary`):
  `floor_block ≈ width*length`, `wall_block ≈ 2*(width+length)*wall_height`, `stair_block ≈ wall_height`.

---

## 7) Fenster & Türen nachrüsten

1. **Fensterhöhe bestimmen** (z. B. mittlere zwei Blöcke einer Säule). Für jede gewünschte Öffnung:
   * `MOVE` auf sichere Position, `break(x, y, z)` für die betroffenen Wandblöcke.
   * Optional `PLACE glass_pane @ ...` oder freilassen.
2. **Türen setzen**:
   * `break` die 2×1‑Öffnung am gewünschten Eingang.
   * `place("door_block", door_base_x, door_base_y, door_base_z)` – achte auf die Blickrichtung (z. B. `face:"south"`).
3. Wiederhole für alle Seiten, symmetrisch, falls gewünscht.

---

## 8) Abschluss‑Checkliste (Symmetrie & Aufräumen)

1. **Symmetrie prüfen**: Wände und Fenster auf allen Seiten identisch? `MOVE` einmal außen herum, vergleiche Perimeter.
2. **Materialreste**:
   * Temporäre Außentreppen oder Säulen entfernen (`CLEAR_TEMP_STAIR`, `break scaffold`).
   * Boden innen fegen (`pick up` gedroppte Items).
3. **Inventar & Logs**:
   * Falls überschüssige Blocks im Wegpunkt lagern müssen → `deposit` in nahe Kiste.
4. **Fertigmeldung**: In Chat/Dashboard kurz bestätigen („Haus fertig, 51/51 Blöcke, alle Scaffold entfernt“).

---

## 7) Akzeptanzkriterien (für den Skill)

* Fundament liegt **eine Ebene unter** dem ursprünglichen Bodenniveau (kein „aufsetzen“).
* Wände werden **schichtweise** errichtet; der Bot bewegt sich **auf** der Wandkrone.
* Eine **temporäre Außentreppe** existiert, die von Boden auf die Krone führt und später **entfernt** wird.
* Kein `PLACE` oder `DIG`, wenn `REACHABLE_PLACE`/`REACHABLE_DIG` nicht erfüllt ist; der Bot **läuft erst heran**.
* Der Bot blockiert sich nicht selbst (kein Platzieren auf dem eigenen Standplatz).

---

### TL;DR

* **Einlassen**: erst **graben**, dann Fundament **in der Grube** setzen.
* **Wände**: **Schicht für Schicht**, der Bot läuft **oben** mit.
* **Zugang**: **temporäre Außentreppe** zum Wieder‑Hochkommen.
* **Reichweite**: **max. ~3–4 Blöcke** zum Zielblock, **nie** auf dem Block stehen, der gesetzt werden soll.
