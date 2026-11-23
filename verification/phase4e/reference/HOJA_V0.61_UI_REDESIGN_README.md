# HOJA LEVEL MAKER V0.61 — UI REBUILD R2

## What changed

- Complete workflow-oriented visual UI rebuild inspired by Nintendo Super Mario Maker 2, Tiled, LDtk (no external editor code copied).
- Asset thumbnails: all 175 original Pixel Adventure 1 PNG files, browsed with search/categories. First frame preview from sprite sheets.
- Four visual tabs: terrain, devices, enemies, complete asset catalog; frequent-part shortcut bar.
- 16×16 Pixel Adventure 1 atlas tile cell selector with drag painting. Exports original PNG path + frameCol/frameRow and optional collision; matching client crops original cell for gameplay rendering.
- Larger map initial viewport centered around spawn, zoom/fit/scroll; visual selected-item properties.
- Undo/redo (50 snapshots), duplicate/delete, keyboard shortcuts, browser autosave, JSON import/export.
- Explicit solid/unlinked vs linked pipe types. No pipe required at all. Destination map and destination pipe selected via dropdown only for linked pipes.
- When a map is deleted, inbound pipe links to deleted map change to unlinked pipes to prevent broken projects.
- Compatible schema: HOJA_MAKER_PROJECT, schemaVersion 6101.

## Run

Place both files IN THE SAME FOLDER:
- HOJA_Level_Maker_V0.61_REDESIGN.html
- HOJA_Client_V0.61.html

Open the Maker file in browser, choose parts graphically, edit, save JSON or click Play Test.
Client retains Phaser CDN dependency and therefore needs internet connection for game runtime. In the client, you can also import Maker JSON manually.

## Important limitations

- A visual asset is not automatically a programmed hazard. Raw PNG assets are placed as graphics except explicitly supported object types (moving platform, spring, saw, etc.).
- The 16×16 tile selector uses frameCol/frameRow for source atlas and independent collision handling. This is a tile stamping prototype, not a full multi-layer collision-aware Tiled editor.
- Some originally promised features (complex event timeline, custom camera controls, every original asset's game logic, arbitrary terrain collision painting) remain unfinished, and FPS ~30 in underground remains unresolved.
- The Maker's browser-facing click/render/save and unit-level link validation were checked in headless Chromium/Node. Complete Phaser play testing was not possible here because of resource access limitations. Verify map round-trip, pipes, collisions and sprite animation in your environment before promoting version.

## Research

- Super Mario Maker 2 — Nintendo: https://supermariomaker.nintendo.com/make/ and https://play.nintendo.com/news-tips/tips-tricks/super-mario-maker-2-tips-tricks/
- Tiled: https://github.com/mapeditor/tiled
- LDtk: https://github.com/deepnight/ldtk
- Systematic: https://github.com/Lolo23450/systematic
- Tilemap Editor: https://github.com/NickDyrr/tilemap-editor

No source code, assets or Nintendo artwork were copied from these projects. Design patterns only.
