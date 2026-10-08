# Hyper Dimension

[English](README.en.md) · [中文](README.md) · [Deployment](DEPLOYMENT.md) · [Education](https://github.com/MkaliezZ/hyper-dimension/blob/main/README.education.md)

**An island that lives, and a steward that gets things done.**

Gather, craft and manage an island in pixel or origami art, talk to AI residents, and ask a Hermes-powered Agent steward to read your working materials, organize plans and create real files. Both appearances share the same save and portfolio. This is the **V136 development snapshot**; full product acceptance is still in progress.

## See the island

[![Hyper Dimension · current 30-second showcase](docs/media/hyper-dimension-poster.png)](https://mkaliezz.github.io/hyper-dimension/?lang=en#overview)

[30-second showcase](https://mkaliezz.github.io/hyper-dimension/?lang=en#overview) · [45-second showcase](https://mkaliezz.github.io/hyper-dimension/?lang=en#tour) · [Gallery interior tour](https://mkaliezz.github.io/hyper-dimension/?lang=en#gallery) · [Current source delivery](https://github.com/MkaliezZ/hyper-dimension/releases/tag/v136)

Click a cover or video title to open the online player. MP4 downloads are available separately inside the player. A dedicated 45-second gallery tour shows the biography, eight life/education/work chapters, three projects with images, a visitor message and the owner’s reply, plus both visual styles.

Native 2560 × 1440, 60 fps footage includes the gallery's biography, experience timeline, project images and guestbook. Profiles, images and work briefs are fictional; the document task actually executes Hermes tools. **Minigames are placeholder demonstrations; their gameplay, art and animation will continue to improve.** [Recording and verification](docs/showcase-v135.md).

## What you can do

| Experience | Current implementation |
| --- | --- |
| Manage an island | 25 production buildings, 50 base materials and 300 recipes; gathering, crafting, visitor spending and running costs. An economic day is 900 seconds of effective play. |
| Live with AI residents | 15 residents act on jobs, personality and relationships, with free conversation, social interaction and cooperative work. Fixed DeepSeek V4.1 Flash model. |
| Delegate to an Agent steward | A dedicated conversation entrance, 12 selectable appearances, access to explicitly delegated local materials, real document creation and a traceable temporary Agent recruitment protocol. |
| Host visitors and show your work | Biography, life/education/employment experience, projects, images and file uploads. Private drafts, explicit publication, authenticated guest messages and owner replies. |
| Switch art styles | One island and save, two appearances; continuous detailed terrain tiles, themed rooms/UI, ocean ripples and shoreline waves. |
| Watch the seasons | Seasonal forests, petals, leaves and snow crystals; 30 visual days per season, 120 per cycle. Day/night visuals are paused; shared-server clock interfaces remain available. |

### Actual game views

| Origami island | Pixel island |
| --- | --- |
| ![Origami island](docs/screenshots/v134-origami-island.png) | ![Pixel island](docs/screenshots/v134-pixel-island.png) |

| Origami gallery interior | Pixel gallery interior |
| --- | --- |
| ![Origami gallery · fictional profile](docs/screenshots/v135-origami-gallery.png) | ![Pixel gallery · fictional profile](docs/screenshots/v135-pixel-gallery.png) |

| Life and education | Projects and pictures |
| --- | --- |
| ![Experience exhibit · fictional profile](docs/screenshots/v135-origami-experiences.png) | ![Project exhibit · fictional profile](docs/screenshots/v135-origami-projects.png) |

## Deploy with a development Agent

The deliverable contains **source, assets, pinned dependencies and a machine-readable deployment protocol**. Your Agent needs terminal and file access. After cloning, enter `island/`; a Release source archive starts directly at the game root.

Read [AGENTS.md](AGENTS.md), [deploy.json](deploy.json) and [DEPLOYMENT.md](DEPLOYMENT.md) first. Node.js 24 and Python 3.11 are recommended. Deployment supports Windows x64 and macOS 14+ on Apple Silicon and Intel.

Windows PowerShell:

```powershell
node tools/agent-deploy.mjs plan
node tools/agent-deploy.mjs doctor --python=python
node tools/agent-deploy.mjs setup --python=python --offline
node tools/agent-deploy.mjs verify
node tools/agent-deploy.mjs run --mode=lan
```

macOS Terminal:

```sh
node tools/agent-deploy.mjs plan
node tools/agent-deploy.mjs doctor --python=python3.11
node tools/agent-deploy.mjs setup --python=python3.11 --offline
node tools/agent-deploy.mjs verify
node tools/agent-deploy.mjs run --mode=lan
```

Default entry: `http://127.0.0.1:4175/play`; local logs contain first-registration information. Standalone modes are `run --mode=pixel` (4173) and `run --mode=origami` (4174). Configure LAN listening explicitly using the deployment guide.

`setup` creates a private `.env.local`. Supply your own `DEEPSEEK_API_KEY`; the model is `deepseek-flash`, without a Pro fallback. Without a key, visuals and local rules can run; AI conversation and Agent tool execution require a correctly configured provider.

## Status and verification boundaries

V136 adds durable steward requests and recovery: save before sending, read the original result after a lost response or reload, and prevent repeated file operations. Both styles were checked with real Hermes/Flash document tools. [Recovery notes](docs/steward-recovery-v136.md). Current footage is labeled V135; visuals and art are unchanged.

V135 restyles the gallery's two themed interiors, biography, experience timeline, project photos and guestbook. Actual editing, uploading, publishing, reload persistence and guest-message flows passed in both appearances. [Gallery notes](docs/gallery-ui-v135.md).

V134 completed continuous terrain, 30-day season changes and paused day/night visuals. Its 807 domain/maintenance checks, focused native-browser scenes and Windows/two-architecture macOS CI passed. [Terrain evidence](docs/continuous-terrain-v134.md) · [Deployment CI](https://github.com/MkaliezZ/hyper-dimension/actions/workflows/island-deploy.yml). CI and bounded development-Windows checks do not establish physical Mac or full human-play acceptance.

## Documentation and repository

- [Deployment and migration](DEPLOYMENT.md) · [Privacy](docs/PRIVACY.md) · [Asset provenance](docs/ASSETS.md)
- [Gallery publishing and messages](docs/portfolio-v130.md) · [Shared clock interface](docs/environment-v131.md) · [Changelog](docs/CHANGELOG.md)
- [Education module](https://github.com/MkaliezZ/hyper-dimension/blob/main/README.education.md): full integration of the island and existing education business is ongoing.

```text
AGENTS.md · deploy.json · DEPLOYMENT.md
src/ · server/          Frontend and local services
public/ · vendor/       Dual-style assets and pinned dependencies
docs/                   Guides, screenshots and verification
```

Run `npm test` in the game source directory for development checks and `node tools/agent-deploy.mjs verify` for deployment verification. Stop this project's writers and create a verified private backup before updating. Rebuild runtimes on each target platform.

The public repository excludes keys, real saves, private conversations, real work documents and installed runtimes. Model/file tasks use your configured services; see [Privacy](docs/PRIVACY.md).

## License and acknowledgements

Original code and documentation retain the repository's [MIT License](LICENSE). Hermes Agent, Playwright, Fusion Pixel Font and dependencies retain their own licenses: [Third-party notices](THIRD_PARTY_NOTICES.md). Art provenance and licensing are documented separately in [Assets](docs/ASSETS.md).
