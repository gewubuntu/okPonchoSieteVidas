# Poncho character references

The user's reference images of Poncho. They are the source of truth for his look. Do not edit or overwrite them.

- `sprite-pixel.jpg`: the main reference (user, 2026-10-25), the user's pixel drawing of Poncho standing side-on. The sprite is this drawing, pixel for pixel, with a tail added (`scripts/art/poncho-pixels.mjs`, `scripts/art/poncho.mjs`). It wins over the images below.
- `reference.jpg`: the illustration (512 x 512, orange background), for his colours, face, taco and PB badge.
- `sprite-side.jpg`, `sprite-back-front.jpg`, `sprite-walk-a.jpg`, `sprite-walk-b.jpg`: the sprite references (user, 2026-10-25): side views, back and front, and two four-frame walk cycles. Poncho is drawn side-on as in these, and where they and the illustration differ, they win for the sprite.

The design notes derived from them are in `docs/GDD.md`: GDD-ART-02 (character), GDD-ART-03 (palette), GDD-ART-04 (animations), GDD-ART-05 (pixel rules), GDD-MOV-06 (size and hitbox). The "PB" marks stand for Poncho on Base (GDD-VIS-05).

The art is pixel art at 1920 x 1080, drawn in code and approved by the user from screenshots (GDD-ART-01). Sprites are redrawn from these images; the originals stay untouched. Poncho is a he (user, 2026-10-25).
