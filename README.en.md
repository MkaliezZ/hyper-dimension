# Hyper Dimension

[English](README.en.md) · [中文](README.md) · [Deployment](island/DEPLOYMENT.md) · [Education](README.education.md)

**An island that lives, and a steward that gets things done.**

Gather, craft and manage an island in pixel or origami art, talk to AI residents, and ask a Hermes-powered Agent steward to read your working materials, organize plans and create real files. Both appearances share the same save and portfolio. This is the **V152 development snapshot**; full product acceptance is still in progress.

## Current update · V152

Theme cursors cover legacy controls. Both appearances persist in one island save. The lobby gives the island more space and groups hospitality controls in a side rail. NPC walking and facing follow server intent. Gallery data is preloaded. [Implementation and regression evidence](island/docs/ui-reliability-v148.md).

Normal lobby map clicks no longer flash a recovery card; failed responses remain recoverable. [Details and native checks](island/docs/lobby-navigation-v151.md).

## See the island

[![Hyper Dimension · Living AI residents and Agent stewards](island/docs/media/hyper-dimension-v145-living-agents-poster.png)](https://mkaliezz.github.io/hyper-dimension/?lang=en#living)

[30-second showcase](https://mkaliezz.github.io/hyper-dimension/?lang=en#living) · [45-second showcase](https://mkaliezz.github.io/hyper-dimension/?lang=en#tour) · [Gallery interior tour](https://mkaliezz.github.io/hyper-dimension/?lang=en#gallery) · [Source packages and release history](https://github.com/MkaliezZ/hyper-dimension/releases)

The cover opens an online player; downloads have a separate control. The new 30-second native recording shows both island styles, AI resident dialogue, selectable steward appearances, an actual Word document task, parent/child Agent cooperation, a minigame inside its building dialog and the completed reward.

2560 × 1440 / 60 fps with original BGM. Footage was captured from V145; current source is V152. Profiles, project images and work briefs are fictional; the Hermes task actually executes tools. **Minigames remain placeholder demonstrations and will continue to improve.** [Video verification](https://github.com/MkaliezZ/hyper-dimension/blob/main/showcase/media/v145-living-verification.json).

### V144 nearby resident sound

Footsteps, work and spoken lines have distance attenuation and stereo position, capped at four nearby residents. Pause clears missed sounds. Both styles pass native audio routing and 16 focused checks. [Rules and evidence](island/docs/spatial-sound-v144.md).

### V143 economic trends

Mature islands may earn a modest passive surplus. The business ledger shows recent visitor net income, active cash flows and full operating balance. Both styles pass a 12-case, 60-day synthetic matrix. [Rules and verification](island/docs/economy-v143.md).

### V142 kitchen preparation

Slice ingredients on the cutting board and manage both stoves. Preparation precision contributes to dish quality. Both styles pass native mouse, mobile touch, Space, disk resume and one exact recipe receipt. [Gameplay and verification](island/docs/kitchen-v142.md).

### V141 starlight gathering

[![V141 · Dual-style collaborative night sky](island/docs/media/hyper-dimension-v141-night-sky-poster.png)](https://mkaliezz.github.io/hyper-dimension/#night)

[Watch the new 16-second gameplay clip](https://mkaliezz.github.io/hyper-dimension/#night): 1440p / 60 fps, the actual island modal, resident attendance, four lantern flights and authoritative payout, with original BGM. The minigame prototype continues to be improved.

Aim four lanterns through changing wind and clouds, use one air correction per flight and light a constellation with the residents who actually arrive. Save/reload preserves flight progress; hosting and rewards retain their existing rules. Both styles pass a zero-stock journey through the first gathering and empty-browser restore, plus 878 default checks. [Gameplay and evidence](island/docs/night-sky-v141.md).

### Map resident selection fix

Rendered names, bodies and detail cards now share a stable resident identity; overlapping targets follow paint order and hover reveals names. All 15 AI residents and the steward pass native map-click checks in both art styles. [Verification](island/docs/npc-map-identity.md).

Map movement and building entry now recover correctly after overlapping overlays; visitor preparation no longer pauses an island before its dialog opens. [Interaction repair](island/docs/map-navigation-v141.md).

### V140 continuous parent/child Agent activity

Real Hermes confirms dependent production; a partner arrives by ferry, walks to the workshop and delivers lanterns. Personal invitations, rewards, contribution, wages, departure and reload pass in both styles. Reentrant cancellation and stale callbacks are fixed. [Flow and scope](island/docs/recruitment-v140.md).

### V139 drawing update

[Watch the 12-second in-room drawing clip](https://mkaliezz.github.io/hyper-dimension/?lang=en#brush): four seeded motifs, continuous brush movement, ink and palette choices, drying layers and framing review. The game stays inside the building modal. [Mechanics and evidence](island/docs/brush-studio-v139.md).

| Pixel drawing | Origami drawing |
| --- | --- |
| ![Pixel drawing](island/docs/screenshots/v139-pixel-drawing.png) | ![Origami drawing](island/docs/screenshots/v139-origami-drawing.png) |

The main steward film is labeled V138, the new drawing clip V139, and the island/gallery tours V135. Minigame improvements are ongoing.

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
| ![Origami island](island/docs/screenshots/v134-origami-island.png) | ![Pixel island](island/docs/screenshots/v134-pixel-island.png) |

| Origami gallery interior | Pixel gallery interior |
| --- | --- |
| ![Origami gallery · fictional profile](island/docs/screenshots/v135-origami-gallery.png) | ![Pixel gallery · fictional profile](island/docs/screenshots/v135-pixel-gallery.png) |

| Life and education | Projects and pictures |
| --- | --- |
| ![Experience exhibit · fictional profile](island/docs/screenshots/v135-origami-experiences.png) | ![Project exhibit · fictional profile](island/docs/screenshots/v135-origami-projects.png) |

| Real steward correspondence · Origami | Real steward correspondence · Pixel |
| --- | --- |
| ![Origami A2A · fictional test owners](island/docs/screenshots/v137-origami-a2a.png) | ![Pixel A2A · fictional test owners](island/docs/screenshots/v137-pixel-a2a.png) |

Separate Hermes/DeepSeek Flash stewards exchange canonical island facts. Owner identities are fictional; the displayed letters came from real agents.

[Watch the corrected 30-second film](https://mkaliezz.github.io/hyper-dimension/?lang=en#bridge): current dual-style island, original-device pairing, real edits/read-back on fictional documents and attributed correspondence. Existing island/gallery films retain their V135 labels. [Capture notes](island/docs/showcase-v138.md).

## Your steward travels with its own workspace

Choose **Connect original device** from the steward, match the pairing marks, and keep your own Hermes running on that computer. Document work continues while visiting an island, alongside attributed steward correspondence. Offline status is explicit; file work is not silently rerouted. [Pairing and recovery](island/docs/device-bridge-v138.md).

## Deploy with a development Agent

The deliverable contains **source, assets, pinned dependencies and a machine-readable deployment protocol**. Your Agent needs terminal and file access. After cloning, enter `island/`; a Release source archive starts directly at the game root.

Read [AGENTS.md](island/AGENTS.md), [deploy.json](island/deploy.json) and [DEPLOYMENT.md](island/DEPLOYMENT.md) first. Node.js 24 and Python 3.11 are recommended. Deployment supports Windows x64 and macOS 14+ on Apple Silicon and Intel.

Windows PowerShell:

```powershell
cd island
node tools/agent-deploy.mjs plan
node tools/agent-deploy.mjs doctor --python=python
node tools/agent-deploy.mjs setup --python=python --offline
node tools/agent-deploy.mjs verify
node tools/agent-deploy.mjs run --mode=lan
```

macOS Terminal:

```sh
cd island
node tools/agent-deploy.mjs plan
node tools/agent-deploy.mjs doctor --python=python3.11
node tools/agent-deploy.mjs setup --python=python3.11 --offline
node tools/agent-deploy.mjs verify
node tools/agent-deploy.mjs run --mode=lan
```

Default entry: `http://127.0.0.1:4175/play`; local logs contain first-registration information. Standalone modes are `run --mode=pixel` (4173) and `run --mode=origami` (4174). Configure LAN listening explicitly using the deployment guide.

`setup` creates a private `.env.local`. Supply your own `DEEPSEEK_API_KEY`; the model is `deepseek-flash`, without a Pro fallback. Without a key, visuals and local rules can run; AI conversation and Agent tool execution require a correctly configured provider.

## Status and verification boundaries

Customize the steward name under Steward → Profile → Display name → Save. The name persists in the server save, across art styles and in visiting parties.

V137 adds cross-island steward correspondence: after both owners enable reception, their own Hermes agents exchange island information and continue the conversation, with attributed letters retained after reload. First-lantern onboarding follows the current material bill. [Exchange notes](island/docs/a2a-information-v137.md).

V136 adds durable steward requests and recovery: save before sending, read the original result after a lost response or reload, and prevent repeated file operations. Both styles were checked with real Hermes/Flash document tools. [Recovery notes](island/docs/steward-recovery-v136.md). Current footage is labeled V135; visuals and art are unchanged.

V135 restyles the gallery's two themed interiors, biography, experience timeline, project photos and guestbook. Actual editing, uploading, publishing, reload persistence and guest-message flows passed in both appearances. [Gallery notes](island/docs/gallery-ui-v135.md).

V134 completed continuous terrain, 30-day season changes and paused day/night visuals. Its 807 domain/maintenance checks, focused native-browser scenes and Windows/two-architecture macOS CI passed. [Terrain evidence](island/docs/continuous-terrain-v134.md) · [Deployment CI](https://github.com/MkaliezZ/hyper-dimension/actions/workflows/island-deploy.yml). CI and bounded development-Windows checks do not establish physical Mac or full human-play acceptance.

## Documentation and repository

- [Deployment and migration](island/DEPLOYMENT.md) · [Privacy](island/docs/PRIVACY.md) · [Asset provenance](island/docs/ASSETS.md)
- [Gallery publishing and messages](island/docs/portfolio-v130.md) · [Shared clock interface](island/docs/environment-v131.md) · [Changelog](island/docs/CHANGELOG.md)
- [Education module](README.education.md): full integration of the island and existing education business is ongoing.

```text
island/                 Game, Agent runtime, assets and tests
  AGENTS.md · deploy.json · DEPLOYMENT.md
  src/ · server/        Frontend and local services
  public/ · vendor/     Dual-style assets and pinned dependencies
  docs/                 Guides, screenshots and verification
src/hyper_dimension/    Existing education business module
web/ · migrations/      Education frontend and database baseline
README.education.md     Education setup and documentation
```

Run `npm test` in the game source directory for development checks and `node tools/agent-deploy.mjs verify` for deployment verification. Stop this project's writers and create a verified private backup before updating. Rebuild runtimes on each target platform.

The public repository excludes keys, real saves, private conversations, real work documents and installed runtimes. Model/file tasks use your configured services; see [Privacy](island/docs/PRIVACY.md).

## License and acknowledgements

Original code and documentation retain the repository's [MIT License](LICENSE). Hermes Agent, Playwright, Fusion Pixel Font and dependencies retain their own licenses: [Third-party notices](island/THIRD_PARTY_NOTICES.md). Art provenance and licensing are documented separately in [Assets](island/docs/ASSETS.md).
