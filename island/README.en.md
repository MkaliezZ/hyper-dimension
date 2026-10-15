# Hyper Dimension

[中文](README.md) · [English](README.en.md)

**A living island. A steward for real work.**

Gather, craft, run your island, host parties and talk freely with AI residents. Delegate research, planning and real document creation to your Hermes Agent steward. Pixel and origami styles share one island and save.

## See the island

[![Hyper Dimension · Island life and Agent stewards](docs/media/hyper-dimension-v190-living-agents-poster.png)](https://mkaliezz.github.io/hyper-dimension/#living)

[Watch the 30-second demo](https://mkaliezz.github.io/hyper-dimension/#living) · [Explore the owner gallery](https://mkaliezz.github.io/hyper-dimension/#gallery)

Original soundtrack. Profiles and briefs are fictional; steward documents were produced with real tools. **Minigames are placeholder demonstrations and will keep improving.**

## Core experiences

| Experience | What you can do |
| --- | --- |
| Run an island | 25 functional building types, 19 crops, 58 materials and 308 recipes. Gather, grow and craft goods for residents, visitors and events. |
| Meet AI residents | 15 residents with distinct jobs, personalities and relationships, free conversation and daily routines. |
| Visit a home | Explore six distinct homes shaped by their owners’ work and interests, try personal hobbies and keep a household journal. |
| Delegate to your steward | Choose a name and one of 12 appearances. Use Hermes for real work and recruit a temporary Agent partner to share tasks. |
| Seasons and two styles | Regional terrain, full-island seasonal art, waves and weather. Each season lasts 30 visual days; weather affects farming and fishing. |
| Showcase and visit | Share experience, projects and images in your gallery, with guest messages. Bring NPC companions and use steward bridging and A2A in multiplayer reception. |

| Pixel · Autumn | Origami · Winter |
| --- | --- |
| ![Pixel autumn island](docs/media/season-v187-pixel-autumn.png) | ![Origami winter island](docs/media/season-v187-origami-winter.png) |

## Quick start

Supports **Windows x64 and macOS 14+ (Apple Silicon / Intel)**; Ubuntu can also run it. Install Node.js 24 and Python 3.11. Run these commands from the game directory.

```sh
node tools/agent-deploy.mjs plan
node tools/agent-deploy.mjs doctor --python=python
node tools/agent-deploy.mjs setup --python=python --offline
node tools/agent-deploy.mjs verify
node tools/agent-deploy.mjs run --mode=lan
```

On macOS, use `--python=python3` instead of `--python=python`. Open `http://127.0.0.1:4175/play` after launch.

Keep API keys in private `.env.local`. Rules mode works without a key. Back up and preserve `data/` and private configuration when updating. You can also give the source to any Agent with terminal access and ask it to follow [DEPLOYMENT.md](DEPLOYMENT.md) and [AGENTS.md](AGENTS.md).

## More

[Deployment and configuration](DEPLOYMENT.md) · [Agents / A2A](docs/a2a-standard-v158.md) · [Downloads](https://github.com/MkaliezZ/hyper-dimension/releases) · [Education module](../README.education.md)

Code is [MIT](LICENSE) licensed. See [third-party notices](THIRD_PARTY_NOTICES.md).
