# Hyper Dimension

[中文](README.md) · [English](README.en.md) · [Deployment](island/DEPLOYMENT.md) · [Education module](README.education.md)

**An island that feels alive, and a steward that gets things done.**

Gather, craft, run your island and host parties. Talk freely with AI residents, or ask a Hermes Agent steward to read your briefs, organize plans and create real work documents. Pixel and origami share one island and save.

## Watch the island

[![Hyper Dimension · Two art styles and a working Agent](island/docs/media/hyper-dimension-v169-living-agents-poster.png)](https://mkaliezz.github.io/hyper-dimension/?lang=en#living)

[Play the 30-second film](https://mkaliezz.github.io/hyper-dimension/?lang=en#living) · [Inside the owner gallery](https://mkaliezz.github.io/hyper-dimension/?lang=en#gallery) · [Source releases](https://github.com/MkaliezZ/hyper-dimension/releases)

1440p / 60 fps with original BGM. New terrain footage comes from V169; resident, document, parent/child Agent and minigame scenes retain their recorded versions and evidence sources. Profiles and task documents are fictional. **Minigames are demonstration prototypes; gameplay, art and animation will continue improving.**

## What's new · V181

All sixteen added residences now match the original origami buildings with matte paper planes, visible folds and simpler silhouettes. Owner identity, door alignment and parcels are preserved; pixel artwork is unchanged. [Art and alignment](island/docs/origami-homes-v181.md) · [Single-player delivery and multiplayer next steps](island/docs/single-player-readiness-v181.md).

All nine V180 Windows/macOS deployment, art and gameplay CI jobs passed. [CI record](https://github.com/MkaliezZ/hyper-dimension/actions/runs/38463636947). Fourteen related V181 geometry/migration/navigation checks pass; cloud results for the new commit are tracked separately.

### V180 · Connected animation and terrain

Characters now use connected joint surfaces with matching tools and garments. All 98 regional terrain joins and landmark perimeters were reviewed in both styles; native local redraws repair the farm, boatyard and photography site. Network errors offer a clear receipt recovery path, and the Mac deployment job has a revised time budget. [Changes, art and evidence](island/docs/terrain-animation-v180.md).

All **1102 required default checks** passed, with native workshop/home entry, shared-save appearance switching and reload checks in both styles. All nine V180 cloud jobs passed.

### V179 · Background work and navigation

Approved navigation can arrive and open views during background settlement, with a separate slow-frame movement budget. Confirmed NPC farm, mine and daily work continue their animation timers and submit completion once. Unconfirmed tool performances settle into an idle wait; soil, inventory and rewards still require authoritative receipts. [Fixes and evidence](island/docs/navigation-arrival-v179.md).

All **1095 default local checks** passed, together with dual-style slow-frame navigation, six reward/cancel recovery flows and actual NPC sow/water checks. Latest macOS cloud results are tracked by commit; character joints and every terrain boundary are under review.

### V178 · Crop growth artwork

All eleven original crops now have dedicated pixel and origami growth art, adding 88 native sprites. All 19 crops have 152 growth-stage sprites with measured soil anchors and appropriate harvesting tools. [Artwork and validation](island/docs/legacy-crop-art-v178.md).

### V177 · Legacy LAN save upgrade

The LAN entry now upgrades legacy item catalogs before play, fixing repeated save conflicts after updating. Existing inventory and activity settlements are preserved. [Save upgrade fix](island/docs/lan-catalog-upgrade-v177.md).

### V176 · Minigames, layout and seasonal content

The boatyard now sits beside the southeastern harbor, with the fireworks workshop on the inner terrace. Routine checkpoints no longer interrupt wardrobe and shared minigame controls; recovery, held input and reward draining were also repaired. [Interaction and layout fixes](island/docs/minigame-input-v176.md).

Eight new crops and eight seasonal foods bring the catalog to **19 crops, 58 materials and 308 recipes**. The new crops have four growth stages in both art styles. Their harvests become food for eating, gifts, resident meals and shop stock. [Crops and recipes](island/docs/seasonal-content-v176.md).

Harvesting distinguishes sickle cutting, fruit picking, leaf gathering, loosening and pulling roots, and lifting pumpkins. Original atlas positions and the V1 achievement set remain intact. Save migration fills missing inventory fields with zero without granting resources.

All **1071 default local checks** passed, alongside six native crafting, claiming and reload flows across both styles. The preceding V175 passed all six platform CI jobs; V176 cloud results are tracked separately. [Validation scope](island/docs/VALIDATION.md) · [V175 CI](https://github.com/MkaliezZ/hyper-dimension/actions/runs/38388258952).

### Recent improvements

[Buildings and parcels](island/docs/parcel-alignment-v174.md) · [Weather and schedules](island/docs/weather-life-v175.md) · [Continuous movement](island/docs/frame-motion-v173.md) · [Save entry recovery](island/docs/save-entry-v172.md) · [Expanded terrain and homes](island/docs/geography-v169.md).

The [published V170 package](https://github.com/MkaliezZ/hyper-dimension/releases/tag/v170) retains its independent offline-rebuild evidence. Source updates, cloud checks and immutable packages are verified separately.

## Life on the island

| Experience | Content |
| --- | --- |
| Start from zero | 25 production buildings, 58 basic materials and 308 recipes; gathering, crafting, visitor spending and island expenses. An operating day is 900 active game seconds. |
| Meet residents | 15 AI NPCs act according to occupation, personality and relationships, with free conversation and cooperative work. The model is DeepSeek V4.1 Flash. |
| Delegate real work | A named steward with 12 selectable appearances uses Hermes to read delegated files, create documents, track tasks and recruit a temporary Agent partner. |
| Showcase and host | The owner gallery supports life, education and employment histories, projects, pictures, uploads, drafts, publishing, visitor messages and replies. |
| Travel with your steward | Multiplayer reception, accompanying NPCs, original-device bridging and standard A2A share attributed cooperation records. Cross-device work needs pairing and an online original device. |
| Change art styles | Pixel and origami terrain, buildings, characters, rooms, items and UI, with native region loading, animated ocean ripples and shore waves. |

Each season lasts 30 visual days. Weather effects, seasonal planting and resident home schedules are connected. Full-map seasonal native artwork, night lighting and moon reflections remain in development; home interiors retain the existing presentation entries.

## Native screenshots

| V178 pixel farm (mature-crop fixture) | V178 origami farm (mature-crop fixture) |
| --- | --- |
| ![V178 pixel crops](island/docs/screenshots/v178-pixel-legacy-farm.png) | ![V178 origami crops](island/docs/screenshots/v178-origami-legacy-farm.png) |

| Pixel island | Origami island |
| --- | --- |
| ![V171 pixel island](island/docs/screenshots/v171-pixel-island.png) | ![V171 origami island](island/docs/screenshots/v171-origami-island.png) |

## Deploy with a development Agent

The deliverable contains **source, artwork, pinned dependencies and a machine-readable deployment protocol**. Windows x64 and macOS 14+ on Apple Silicon / Intel are supported; Ubuntu can also run it. Enter `island/` after cloning. A Release source archive starts directly at the game root.

Have an Agent with terminal and file access read [AGENTS.md](island/AGENTS.md), [deploy.json](island/deploy.json) and [DEPLOYMENT.md](island/DEPLOYMENT.md), then run:

```sh
node tools/agent-deploy.mjs plan
node tools/agent-deploy.mjs doctor --python=python
node tools/agent-deploy.mjs setup --python=python --offline
node tools/agent-deploy.mjs verify
node tools/agent-deploy.mjs run --mode=lan
```

On macOS, usually select `--python=python3`. Node.js 24 and Python 3.11 are recommended. `--offline` uses bundled pinned dependencies on Windows/macOS CPython 3.11.

- `lan`: reception and island at `http://127.0.0.1:4175/play` by default.
- `pixel` / `origami`: individual launch modes; appearance switching still shares the same save.
- Keep API keys in private `.env.local` or environment variables. Without a key, rules mode works.
- Preserve `data/`, private configuration and original-device workspaces during updates; back up before migration.

## Development and interfaces

- [Game source and deployment](island/AGENTS.md) · [Standard A2A 1.0](island/docs/a2a-standard-v158.md) · [Original-device bridge](island/docs/device-bridge-v138.md)
- [Materials and recipes](island/docs/production-contracts-v114.md) · [Economy trends](island/docs/economy-v143.md) · [Resident life](island/docs/resident-life-v112.md)
- [Validation scope](island/docs/VALIDATION.md) · [GitHub Actions](https://github.com/MkaliezZ/hyper-dimension/actions) · [Releases](https://github.com/MkaliezZ/hyper-dimension/releases)

## License

Code is [MIT](LICENSE). See [third-party notices](island/THIRD_PARTY_NOTICES.md). New island artwork was generated for this project. Public media uses only isolated demonstration worlds and fictional data.
