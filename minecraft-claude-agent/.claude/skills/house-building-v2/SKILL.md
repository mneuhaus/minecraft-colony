---
name: Hausbau v2 — Eingelassenes Fundament, Schichtbau, Außentreppe
description: "Verwenden, wenn der Bot ein rechteckiges Haus mit eingelassenem Fundament bauen soll: Wände schichtweise von der Wandkrone hochziehen, temporäre Außentreppe für Zugang, strikte Reichweiten‑/Belegungsregeln. Geeignet für Größen ~4–10 Blöcke Seitenlänge. Voraussetzung: freier Bauplatz + Material (Boden/Wand/Treppe) im Inventar."
allowed-tools: place_block, use_item_on_block, move_to_position, look_at, dig_block, equip_item, craft_item, find_block, find_entity, get_position, list_inventory
---

# SKILL: house_building_v2

**Ziel:** Ein rechteckiges Minecraft‑Haus bauen, mit **eingelassenem Fundament**, **Wände schichtweise** aufmauern (der Bot läuft auf der Wandkrone mit) und **temporären Außentreppen**, um später wieder hochzukommen.

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
4. **Wände schichtweise hochziehen (auf der Wandkrone laufen)**
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
```

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

### 3.3 Schichtweises Hochmauern (auf der Krone laufen)

Ziel: jede Schicht **einmal ringsrum**, Bot steht **auf der Wand**, um die nächste Schicht im Gehen zu setzen.

```
MACRO BUILD_WALLS_LAYERED(p0, width, length, wall_block, wall_height, torch_cadence) {
  y := 1;                # erste Lage über Fundament (p0.y + y)
  step := 0;
  WHILE y <= wall_height {
    FOR each rim r IN PERIMETER(RECT(p0,width,length)) {
      target := (r.x, p0.y + y, r.z);   # Blockposition der aktuellen Schicht
      IF SAFE_PLACE[target] { PLACE wall_block @ target; }

      # Entlang des Randes einen Schritt weiter: (dx, dz) ist der nächste Perimeter‑Schritt
      next := (r.x + dx, r.y, r.z + dz);
      # Bei Höhenstufe: erst prüfen, ob Kopf frei ist; sonst Zwischenstufe setzen
      IF HEAD_CLEAR(next) {
        MOVE world(next.x, next.y, next.z);
      } ELSE {
        PLACE wall_block @ world(next.x, next.y, next.z) FACE up;  # Zwischenstufe
        MOVE world(next.x, next.y, next.z);
      }

      # Beleuchtung in Taktung – Fackel außen an der Wand platzieren
      step := step + 1;
      IF (step % torch_cadence == 0) { PLACE TORCH @ OUTER_FACE_OF_WALL(target); }
    }
    # eine Lage höher auf die neue Krone wechseln (senkrecht +1)
    MOVE world(CURRENT_X, CURRENT_Y + 1, CURRENT_Z);
    y := y + 1;
  }
}
```

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

## 4) Intent → Plan (Beispielprogramm)

**Intent:** `BUILD_HOUSE` mit `{ width:7, length:9, wall_height:3, floor_block:COBBLE, wall_block:OAK_PLANKS, stair_block:COBBLE, torch_cadence:7 }`.

**Kompilierter Plan (x/y/z‑Skizze):**

```
# 1) Vermessen
MARK start_corner;

# 2) Ausheben
EXCAVATE_RECT(start_corner, 7, 9);

# 3) Fundament legen
LAY_FOUNDATION(start_corner, 7, 9, COBBLESTONE);

# 4) Wände schichtweise mitlaufen
BUILD_WALLS_LAYERED(start_corner, 7, 9, OAK_PLANKS, 3, 7);

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
