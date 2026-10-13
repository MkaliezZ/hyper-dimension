# Hyper Dimension

[中文](README.md) · [English](README.en.md) · [Deployment](DEPLOYMENT.md) · [Education module](../README.education.md)

**An island that feels alive, and a steward that gets things done.**

Gather, craft, run your island and host parties. Talk freely with AI residents, or ask a Hermes Agent steward to read your briefs, organize plans and create real work documents. Pixel and origami share one island and save.

## Watch the island

[![Hyper Dimension · Two art styles and a working Agent](docs/media/hyper-dimension-v169-living-agents-poster.png)](https://mkaliezz.github.io/hyper-dimension/?lang=en#living)

[Play the 30-second film](https://mkaliezz.github.io/hyper-dimension/?lang=en#living) · [Inside the owner gallery](https://mkaliezz.github.io/hyper-dimension/?lang=en#gallery) · [Source releases](https://github.com/MkaliezZ/hyper-dimension/releases)

1440p / 60 fps with original BGM. New terrain footage comes from V169; resident, document, parent/child Agent and minigame scenes retain their recorded versions and evidence sources. Profiles and task documents are fictional. **Minigames are demonstration prototypes; gameplay, art and animation will continue improving.**

## What's new · V178

All eleven original crops now have dedicated pixel and origami growth art, adding 88 native sprites. All 19 crops have 152 growth-stage sprites with measured soil anchors and appropriate harvesting tools. [Artwork and validation](docs/legacy-crop-art-v178.md).

### V177 · Legacy LAN save upgrade

The LAN entry now upgrades legacy item catalogs before play, fixing repeated save conflicts after updating. Existing inventory and activity settlements are preserved. [Save upgrade fix](docs/lan-catalog-upgrade-v177.md).

### V176 · Minigames, layout and seasonal content

The boatyard now sits beside the southeastern harbor, with the fireworks workshop on the inner terrace. Routine checkpoints no longer interrupt wardrobe and shared minigame controls; recovery, held input and reward draining were also repaired. [Interaction and layout fixes](docs/minigame-input-v176.md).

Eight new crops and eight seasonal foods bring the catalog to **19 crops, 58 materials and 308 recipes**. The new crops have four growth stages in both art styles. Their harvests become food for eating, gifts, resident meals and shop stock. [Crops and recipes](docs/seasonal-content-v176.md).

Harvesting distinguishes sickle cutting, fruit picking, leaf gathering, loosening and pulling roots, and lifting pumpkins. Original atlas positions and the V1 achievement set remain intact. Save migration fills missing inventory fields with zero without granting resources.

All **1071 default local checks** passed, alongside six native crafting, claiming and reload flows across both styles. The preceding V175 passed all six platform CI jobs; V176 cloud results are tracked separately. [Validation scope](docs/VALIDATION.md) · [V175 CI](https://github.com/MkaliezZ/hyper-dimension/actions/runs/38388258952).

### Recent improvements

[Buildings and parcels](docs/parcel-alignment-v174.md) · [Weather and schedules](docs/weather-life-v175.md) · [Continuous movement](docs/frame-motion-v173.md) · [Save entry recovery](docs/save-entry-v172.md) · [Expanded terrain and homes](docs/geography-v169.md).

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
| ![V178 pixel crops](docs/screenshots/v178-pixel-legacy-farm.png) | ![V178 origami crops](docs/screenshots/v178-origami-legacy-farm.png) |

| Pixel island | Origami island |
| --- | --- |
| ![V171 pixel island](docs/screenshots/v171-pixel-island.png) | ![V171 origami island](docs/screenshots/v171-origami-island.png) |

## Deploy with a development Agent

The deliverable contains **source, artwork, pinned dependencies and a machine-readable deployment protocol**. Windows x64 and macOS 14+ on Apple Silicon / Intel are supported; Ubuntu can also run it. Enter `island/` after cloning. A Release source archive starts directly at the game root.

Have an Agent with terminal and file access read [AGENTS.md](AGENTS.md), [deploy.json](deploy.json) and [DEPLOYMENT.md](DEPLOYMENT.md), then run:

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

- [Game source and deployment](AGENTS.md) · [Standard A2A 1.0](docs/a2a-standard-v158.md) · [Original-device bridge](docs/device-bridge-v138.md)
- [Materials and recipes](docs/production-contracts-v114.md) · [Economy trends](docs/economy-v143.md) · [Resident life](docs/resident-life-v112.md)
- [Validation scope](docs/VALIDATION.md) · [GitHub Actions](https://github.com/MkaliezZ/hyper-dimension/actions) · [Releases](https://github.com/MkaliezZ/hyper-dimension/releases)

## License

Code is [MIT](../LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md). New island artwork was generated for this project. Public media uses only isolated demonstration worlds and fictional data.
