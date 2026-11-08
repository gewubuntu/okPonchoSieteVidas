# World 2 enemy references

The design of World 2's three new enemies (GDD-ENM-03), as the user approved it (user, 2026-11-08: "Approved, build them into the game")
from an animated design page, designed without reference images (user, 2026-11-08: "No, design them"). Do not edit or overwrite these files.

- `design.html`: the design page as approved: every enemy on a market stage playing its moves at game speed (60 steps a second), its lore
  and every frame. Open it in a browser; it is self-contained.
- `design-sheet.png`: a still of that page.

The sprites are drawn in code by `scripts/art/enemies2/` (one module per enemy, `kit.mjs` for World 2's palette and the shared helpers,
`preview.mjs` for a review sheet beside Poncho and World 1's Alacrán and Tlacuache) and written by `scripts/art/make-enemies.mjs` to
`assets/sprites/enemies/`.

- **Paloma:** the rock pigeon of every Mexican plaza (*Columba livia*), the bird of "Cucurrucucú paloma". Pigeon grey, a teal and rosa neck
  sheen, a gold eye with a smug half-lid, pink feet. It struts with a head-bob, puffs up like a courting pigeon (its telegraph), claps its
  wings to take off, hovers and glides back down.
- **Chapulín:** the grasshopper of Chapultepec (*Sphenarium purpurascens*; Nahuatl *Chapoltepēc*, "hill of the grasshopper", whose glyph is
  a green grasshopper with a red mouth). Wingless, so it only hops. The darker leaf green, a yellow-striped belly, rosa shins and mouth, a
  big eye. It chews, winds up, launches, lands nose down, and is flung up splayed by an awning.
- **Trompo:** the wooden top of the toy stall, the one kids play la troya with. Turned wood, lacquer bands, an iron nail for a tip and a
  stern painted face that goes round as it spins; three pale tacks on its crown, the not-stompable mark. Toppled, it lies dizzy and rocks
  before it gets up.
- **Colours:** only World 2's palette (GDD-ART-06), the Chapulín's darkened leaf, the outline shared with Poncho (GDD-ART-05) and the
  telegraph red every world shares (GDD-ENM-01).
- **Tone (GDD-VIS-04):** a real animal of the town and a real toy of its market, charm first; none of them dressed.
