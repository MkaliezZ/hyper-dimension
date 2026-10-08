# Hyper Dimension

> This directory is the island source bundle. Omit cd island when already here. The repository layout describes the full GitHub repository; this source bundle contains the island module.

[English](README.en.md) · [中文](README.md) · [Deployment](DEPLOYMENT.md) · [Education module](https://github.com/MkaliezZ/hyper-dimension/blob/main/README.education.md)

**An island that lives, with an agent that gets things done.**

Play, gather, craft and build a life alongside AI residents in a pixel or origami island. Your Hermes-powered steward also handles real-world tasks you delegate: reading work materials, organizing plans and saving documents. **V128 is a playable development snapshot**, with full product acceptance still in progress.

V128 raises the bounded save capacity to 16 MiB and signed backup/import capacity to 64 MiB, preserving transaction receipts and progress. Both themes passed large-save and fresh-browser recovery checks. [Fix and validation scope](docs/save-capacity-v128.md).

V125 completes tiled terrain integration: the initial overview, zoomed tiles and missing-tile fallback use the same painted terrain in both appearances and co-op rooms. [Terrain details and actual screenshots](docs/terrain-v125.md).

V123 gives all 300 products explicit material bills and construction notes, corrects cross-workshop inputs and durable-item uses, and preserves accepted task costs, with reliable recipe selection and isolated recovery receipts. [See production changes and verification scope](docs/craft-materials-v123.md).

V122 adds high-resolution expanded-ocean tiles and completes terrain loading without worker support, with bounded retries for transient failures. [Native game checks in both styles](docs/terrain-v122.md).

V120 uses the new terrain tiles in both the default overview and close-ups, with complete-view loading. [Changes and actual game checks](docs/terrain-v120.md).

V119 adds 26 newly painted terrain tiles/landmarks, viewport loading and crisp zoom in both styles. [Terrain changes and native checks](docs/terrain-v119.md).

V118 shares one island save across pixel/origami appearances, adds free-text chat with all 15 residents, and persists butler/player avatar selections. [Behavior and verification scope](docs/shared-island-v118.md).

V117 gives 55 tools and objects explicit material bills and construction notes while preserving accepted work contracts. [See the material changes and native verification scope](docs/craft-materials-v117.md).

V116 improves meal planning and arrival-time replanning, with clearer model reply validation and error records. The low-frequency Flash policy is unchanged. [See changes and verification scope](docs/npc-recovery-v116.md).

V115 recovers from temporary Windows save-file locks with bounded asynchronous retries while preserving the original file on persistent failures. [See the fix and verification scope](docs/save-recovery-v115.md).

V114 preserves accepted crafting costs across recipe updates and fixes invalid resident activity dispatch. [See changes and verification scope](docs/production-contracts-v114.md).

V113 adds shopfront controls for all 25 venues and 300 crafted products: choose what to sell, keep materials for crafting, and complete sales against real stock and visitor budgets. [See gameplay and verification scope](docs/shopfronts-v113.md).

V112 connects personality, recent activities and actual relationships to resident routines, with reading, music/color practice and persistent social boundaries. [See behavior and verification scope](docs/resident-life-v112.md).

V111 ties resident cooperation to actual event needs: occupation-specific jobs, real crafting and harvest receipts, protected cooperative beds, and fixes for arrival detection and multi-step farming. [See the cooperation update and journals](docs/resident-cooperation-v111.md).

V110 keeps completed link/match boards retryable until settlement is acknowledged. [See the recovery changes and validation scope](docs/classic-settlement-v110.md).

V109 updates both boarding gangways, ferry alignment and passenger occlusion. [See the harbor update and in-game captures](docs/harbor-art-v109.md). The videos below were recorded in V108.

## Gameplay video: 30 seconds + 45-second feature tour

[![Hyper Dimension gameplay preview: origami and pixel islands](docs/media/hyper-dimension-poster.png)](https://github.com/MkaliezZ/hyper-dimension/releases/download/v108/hyper-dimension-30s.mp4)

**[▶ Watch / download the 30-second MP4](https://github.com/MkaliezZ/hyper-dimension/releases/download/v108/hyper-dimension-30s.mp4)** · [Get the agent deployment bundle](https://github.com/MkaliezZ/hyper-dimension/releases/tag/v128)

2560 × 1440 at 60 FPS, with an original instrumental score and bilingual captions. The footage shows an actual AI resident conversation, selectable steward appearances, native Hermes delegation, a Coastal Kitchen challenge inside its building window, and a real Word document made from a fictional brief. Waiting is edited out; no real user data appears.

[Watch the 45-second feature tour](https://github.com/MkaliezZ/hyper-dimension/releases/download/v108/hyper-dimension-45s.mp4) for both avatar galleries, candidate professions and the main/sub-agent exchange.

**The current minigames are placeholder demonstrations. Gameplay, art and animation will continue to be refined; this is not final quality.** The film illustrates the product direction, not full product acceptance.

## On the island

- **Two visual styles, one simulation:** themed maps, buildings, characters, items and UI in pixel and origami.
- **An operating loop:** gather → craft → use / display / serve visitors → earn → improve facilities. An active game day lasts 900 seconds.
- **25 buildings, 15 AI residents and one steward:** farming, mining, workshops, a harbor and an event plaza, with pathfinding and work / needs-based routines.
- **Minigames and parties:** cooking, pottery, fishing, styling and puzzles; night markets, fishing gatherings, fairs, fashion shows and fireworks.
- **A Hermes steward:** conversation, recipe assignments, material preparation, recruitment and explicitly requested local document work, with execution records.
- **Server-managed saves:** file-backed state, protected resource and work receipts, backup / restore and fresh-browser recovery.
- **Local visiting and multiplayer foundations:** separate accounts and islands, traveling stewards and invited residents, social encounters and limited A2A. Cross-device steward bridging remains in development.

V108 adds portrait-led parent/child Agent exchanges and retains a minigame result when completion is temporarily refused, so the player can retry. The full 20-cycle Intel Mac test now has a workload-based timeout; no assertions were removed. [Cross-platform CI](https://github.com/MkaliezZ/hyper-dimension/actions/workflows/island-deploy.yml).

### AI life and real-world work

| A resident with their own goals | A steward delivering a real file |
| --- | --- |
| ![Actual AI resident decision](docs/media/ai-resident.png) | ![Hermes saves and verifies a Word document](docs/media/agent-document.png) |

The work brief is fictional. Hermes actually reads it, calculates a 12-carton restock and CNY 216 budget, then saves a usable Word document. The file is verified, not merely mentioned in chat.

### Actual screenshots

| Origami island | Pixel island |
| --- | --- |
| ![Origami island](docs/media/origami-island.png) | ![Pixel island](docs/media/pixel-island.png) |

| Coastal kitchen | The patient potter |
| --- | --- |
| ![Origami cooking minigame](docs/media/origami-kitchen.png) | ![Pixel pottery minigame](docs/media/pixel-pottery.png) |

## Deploy with your agent

The repository and Release bundle include source, assets, pinned dependencies and a deployment protocol. **No installer or specific agent brand is required.** Your development agent needs terminal and file access.

1. Clone the repository and enter island/, or extract the Agent Source release bundle.
2. Ask your agent to read AGENTS.md, deploy.json and DEPLOYMENT.md.
3. Use Node.js 24 (recommended) and Python 3.11. Rebuild the runtime on the target machine.

Windows PowerShell:

    cd island
    node tools/agent-deploy.mjs plan
    node tools/agent-deploy.mjs doctor --python=python
    node tools/agent-deploy.mjs setup --python=python --offline
    node tools/agent-deploy.mjs verify
    node tools/agent-deploy.mjs run --mode=lan

macOS Terminal:

    cd island
    node tools/agent-deploy.mjs plan
    node tools/agent-deploy.mjs doctor --python=python3.11
    node tools/agent-deploy.mjs setup --python=python3.11 --offline
    node tools/agent-deploy.mjs verify
    node tools/agent-deploy.mjs run --mode=lan

The default local visiting URL is http://127.0.0.1:4175/play; local server output provides first-registration information. For standalone play, use run --mode=pixel (4173) or run --mode=origami (4174). The independent minigame collection is at /src/arcade.html. Follow the deployment guide to explicitly enable LAN listening.

Setup creates an empty private .env.local. Add your own DEEPSEEK_API_KEY if desired; never commit it. Local gameplay and rules can be checked without a key, but that does not establish AI connectivity. The configured model is deepseek-flash, without a Pro fallback.

## Platform and acceptance status

| Platform | Verified scope |
| --- | --- |
| Windows x64 | Independent V107 extraction, offline setup, 659 rule checks, and both themes in standalone / LAN gathering and save-reopen checks. |
| macOS 14+ Apple Silicon / Intel | Deployment protocol, conditional dependency closure and packaged file integrity; physical Mac execution remains unverified. |

V107 fixes obsolete work destinations after ingredient availability changes during a resident's journey. Both themes passed automated native Hermes / Flash recipe assignments from zero inventory, physical travel, crafting, protected delivery and fresh-browser restore. The economy also passed 12 domain scenarios of 30 game days each; this does not validate every live AI, recruitment and event economy together.

Outstanding work includes cross-device steward bridging, broader human and multi-device testing, minigame polish, ten real parent / sub-agent cooperative events and OPC newcomer course validation. **This is a runnable development snapshot, not a completed commercial release.** See [validation notes](docs/VALIDATION.md).

## Repository layout

    island/                  Current island game, agent runtime, assets and tests
      AGENTS.md              Agent deployment entry point
      deploy.json            Machine-readable deployment protocol
      src/ · server/         Frontend and local services
      public/ · vendor/      Dual-theme assets and pinned dependencies
      docs/                  Screenshots, provenance and validation notes
    src/hyper_dimension/      Existing education business module
    web/ · migrations/       Education frontend baseline and database migrations
    README.education.md      Existing education setup and documentation

Full integration between the island and education modules remains in progress. The education code and history have been preserved.

## Development and data

Run npm test inside island/, or node tools/agent-deploy.mjs verify for deployment checks. Browser checks are documented in the deployment guide. Before an update, stop this project's writers and create and verify a private backup. Do not copy a Windows virtual environment onto macOS.

This public repository excludes credentials, real account saves, conversation history, student records, production logs and installed runtimes. Requested document work and model conversations use the services you configure; provide only the context you intend to share. See [privacy and publication scope](docs/PRIVACY.md).

## License and credits

First-party code and documentation follow the existing [MIT License](LICENSE). Hermes Agent, Playwright, Fusion Pixel Font and Python dependencies retain their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md). Artwork provenance is described in [asset notes](docs/ASSETS.md). The project's MIT license does not replace third-party terms.
