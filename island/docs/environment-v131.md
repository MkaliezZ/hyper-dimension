> Current V134 behavior and native evidence: [continuous-terrain-v134.md](continuous-terrain-v134.md). The clock protocol retains day phase for future central synchronization; it no longer changes scene lighting.

# Shared world time and animated ocean / 共享时令与动态海面

> V132 replaces the initial foliage recoloring with original seasonal forest paintings and richer falling animations. / V132 季节素材已改为重绘林地，详见 [实景](gallery-seasons-v132.md)。

## Player experience

Both pixel and origami appearances have world-anchored sea ripples, three overlapping shoreline crests and subtle daylight reflections. The coastline mask includes the continuous Islander Gallery garden; waves cannot paint over land. V134 pauses all day/night color overlays, night dimming, lighthouse beams and night-only particles. Seasonal foliage and drifting petals/leaves/snow remain active. Home islands and shared-room visits use the same server clock. Click the season/time badge to see the calendar.

The visual clock continues with real elapsed time. It is separate from the 900-second **effective game time** economy clock: closing the game does not produce income, subtract operating charges or advance economic receipts.

## Default and central configuration

The default shared clock is persisted outside individual saves in `data/environment/environment-clock.json`. One visual day is 15 minutes; each season lasts 30 visual days; the complete cycle lasts 120 visual days. Windows/macOS standalone appearances and LAN runtime using the same data root share it. To isolate deployments, set a separate `HD_ENVIRONMENT_DIR`.

A future central server can supply the same protocol through its GET endpoint. Set these private values in `.env.local` or the service environment, then restart the runtime:

```dotenv
HD_WORLD_CLOCK_URL=https://world.example.test/api/clock
HD_WORLD_CLOCK_TOKEN=
HD_ENVIRONMENT_DIR=data/environment
```

The URL is optional. No game saves, NPC memories, portfolio data or real work documents are sent to it; requests contain only Accept and the optional Bearer credential. Credentials never appear in the browser/status output. The URL must be HTTP(S), without embedded credentials or a fragment. Redirects are not followed.

Example central response (replace epoch and identifiers with the central server's real values):

```json
{
  "clock": {
    "schema": 1,
    "clockId": "world-primary",
    "revision": 1,
    "epochMs": 1791460800000,
    "phaseAtEpoch": 0.5,
    "dayLengthMs": 900000,
    "seasonDays": 30,
    "seasonOffset": 0,
    "rate": 1,
    "source": "central"
  }
}
```

`phaseAtEpoch` is the fraction of a visual day at the epoch (0 = midnight, 0.5 = noon). `seasonOffset` advances the seasonal cycle in visual days; seasons rotate spring/summer/autumn/winter. Advance `revision` for every change to the same `clockId`. `rate` changes visual speed only. The local GET `/api/world/environment` exposes sanitized clock metadata and `serverNowMs`; it does not accept client edits.

Providers poll at most once per minute per runtime, asynchronously, with a 2.5-second timeout and 16 KiB response cap. Failures retain the last valid clock. Initial creation atomically publishes a complete file; subsequent shared-runtime writes reject stale or conflicting revisions under a file mutex. Clients interpolate with a monotonic timer and blend changes over four seconds.

## Rendering and verification

WebGL2 uses one cached distance-field shader pass. Missing or lost WebGL uses the 2D renderer; restoration rebuilds the shader. The terrain uses existing high-resolution tiles and newly painted seasonal forest tiles (V132), avoiding a fresh per-pixel scan on every frame. Pixel appearance quantizes wave detail; origami uses softer curved highlights.

Evidence is scoped to native browser runs on the development Windows PC. Historical V132: sixteen home-scene combinations (two appearances × four seasons × day/night), zoom/pan and p95 frame checks have passed; shared-room and fallback verification reports document their own outcomes. Domain checks cover clock phases, season boundaries, provider failures, shared first-boot creation and stale revisions. This does not claim physical Mac, full-product or human acceptance.

## 中文摘要

双画风海面新增固定在世界坐标上的水纹与三重近岸浪，遮罩包含东岸会客馆庭院；V134 已暂停昼夜视觉效果，四季仍改变林地并有花瓣、落叶与雪。主岛与联机会客共享同一时钟，点击时令标签查看日历。

默认 15 分钟一个视觉日、每季 30 个视觉日、完整循环 120 日；数据独立于经营存档。离线时令轮换不会产生离线收益或运营扣款。配置 `HD_WORLD_CLOCK_URL`、私有 `HD_WORLD_CLOCK_TOKEN` 与可选 `HD_ENVIRONMENT_DIR` 即可预留总服务器统一时令接口。元数据接口只读，联网失败保持最近有效时令；不上传游戏、NPC、展馆或现实文档数据。

Shader、兼容渲染、联机与实际性能证据分别记录，整体目标与新宣传视频不因本功能自动完成。
