# How to play Tango

Tango is a logic puzzle on an even-sized grid (4×4, 6×6, 8×8, 10×10). Every cell
holds a **Sun** (☀) or a **Moon** (🌙). Some cells are given as locked clues; you
fill the rest. **Every puzzle has exactly one solution, reachable by pure logic —
you never have to guess.**

In Tango Trainer: **left-click** a cell to cycle `empty → Sun → Moon → empty`,
**right-click** to cycle the other way, **double-click / long-press** to clear.
Locked clues show a small lock and cannot be changed.

---

## The four rules

### Rule 1 — No three in a row
No three identical symbols may sit next to each other in a line, horizontally or
vertically. Two is fine; three is not.

```
allowed:  ☀ ☀ 🌙        illegal:  ☀ ☀ ☀
```

### Rule 2 — Balance
Every row and every column must hold an equal number of Suns and Moons — exactly
half of each. (A 6-wide line: three Suns and three Moons.)

```
☀ 🌙 ☀ 🌙 🌙 ☀   ✔ three and three
```

### Rule 3 — Equals ( = )
Two cells joined by `=` on their shared edge hold the **same** symbol.

```
☀ = ☀      🌙 = 🌙
```

### Rule 4 — Cross ( × )
Two cells joined by `×` on their shared edge hold **opposite** symbols.

```
☀ × 🌙      🌙 × ☀
```

---

## Techniques that crack every puzzle

You never guess. Each move is forced by one of these named deductions (the same
ones the app's Hint ladder and step-by-step solver use).

**Pair forces the neighbour.** Two identical symbols side by side force the cell
on either end to the opposite — otherwise you'd make three in a row.

```
☀ ☀ _   →   ☀ ☀ 🌙
```

**Sandwich.** A gap between two identical symbols must be the opposite.

```
☀ _ ☀   →   ☀ 🌙 ☀
```

**Line complete.** Once a line already contains all N/2 of one symbol, every
remaining cell in it must be the other symbol.

```
row has 3 of 3 Suns  →  all other cells are Moons
```

**Avoid a forced triple.** If putting a symbol in a cell would leave the line
impossible to finish without a triple, place the opposite instead.

**Propagate = and ×.** From any filled cell, an `=` copies its symbol to the
joined cell and a `×` flips it. Chain these across the board:

```
☀ = ☀ × 🌙 = 🌙
```

**Proof by contradiction (hard puzzles only).** If assuming one symbol in a cell
leads to a dead end — some other cell ends up with no legal symbol — then the
cell must be the opposite. This is still deduction, not guessing: one option is
provably impossible.

---

## A worked 6×6 solve

Here is a full easy puzzle (`?seed=howto-demo`). `S` = Sun, `M` = Moon, `.` =
empty. Rows and columns are numbered from 1.

**Given clues**

```
      C1 C2 C3 C4 C5 C6
  R1   .  .  .  S  M  .
  R2   .  S  .  .  .  M
  R3   M  .  .  .  .  .
  R4   .  M  .  .  .  S
  R5   .  .  S  .  .  .
  R6   .  S  .  .  .  .
```

**Constraints:** `R1C5 = R2C5`, `R2C2 × R3C2`, `R5C6 × R6C6`.

**The deductions, in order**

1. **R2C5 = Moon** — the `=` links it to the Moon at R1C5, so it must match.
   *(Propagate =)*
2. **R3C2 = Moon** — the `×` links it to the Sun at R2C2, so it must be opposite.
   *(Propagate ×)*
3. **R3C5 = Sun** — R1C5 and R2C5 are both Moons; the cell continuing that column
   run must break it. *(Pair forces the neighbour)*
4. **R2C4 = Sun** — two Moons at R1C5/R2C5 and the pair logic around R2 force it.
   *(Pair forces the neighbour)*
5. **R3C4 = Moon**, **R3C3 = Sun**, **R5C2 = Sun**, **R6C1 = Moon** … each forced
   the same way by a pair or a completed line.

Continue applying the techniques — every remaining cell is forced — until the
board is full:

**Solution**

```
      C1 C2 C3 C4 C5 C6
  R1   S  M  S  S  M  M
  R2   S  S  M  S  M  M
  R3   M  M  S  M  S  S
  R4   S  M  M  S  M  S
  R5   M  S  S  M  S  M
  R6   M  S  M  M  S  S
```

Check it: every row and column has three Suns and three Moons, there is never a
run of three, and all three constraints hold.

> **Tip:** In the app, press **H** for a graded hint (it reveals only as much as
> you ask), or use **Tools → Watch the solve** to replay this exact derivation
> one forced move at a time, with the technique named for each step.
