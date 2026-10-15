# V187 · Whole-island seasons / 整岛四季底图

## What changed / 本次改动

Both pixel and origami now render spring, summer, autumn and winter throughout the expanded island, including the mountain, farm, residences, plaza and owner gallery. Each view uses 30 regional tiles plus 14 landmark/join pieces. Summer retains the calibrated native terrain; the other seasons add 240 native regional variants. Four sensitive porch/court joins per style and season add 32 repair images. Eight 2304 × 1792 previews are composed from those same pieces.

像素与折纸均接入整岛四季：春季花木、夏季绿植、秋季黄叶与冬季积雪覆盖山地、农田、住宅区、广场及会客馆。每种画风每季使用30个区域块及14个局部块。新素材共280张（240张季节区域图、32张连接修正图、8张整岛预览），约868 MB。未改动建筑、农田、NPC身份与寻路坐标；现有作物、天气及作息规则继续使用。

## Loading and seams / 加载与连接

- A new season replaces the previous view only after all visible regional tiles and local repairs are ready, followed by a four-second transition. Missing native tiles preserve the last complete season.
- A cold pan shows the current season's overview until its detailed regions arrive. Theme changes dispose stale decoded art. Pixel rendering keeps nearest-neighbor sampling; origami keeps smooth sampling.
- The decoded terrain tile and two-preview cache has a 128 MiB budget. This is not a cap on total browser, display-canvas or GPU memory.
- Regional cuts and 112 seasonal patch-edge profiles avoid broad translucent tree overlaps. The origami southwest yard was corrected from an erroneous pond to dry building ground. Small vegetation/texture variations at joins remain a polish opportunity.
- The clock remains 30 visual days per season and 900 seconds per visual day. The shared environment descriptor and central synchronization interface remain available.

新季节的可见分块与连接图加载齐全后，再进行4秒过渡；加载失败保留上一季完整画面。拖到新区域先使用同季节预览，不闪回夏季。原有落花、落叶、雪花及天气粒子继续配合底图；没有新增全屏染色滤镜。

## Evidence / 验证

- 33 focused terrain, mask, clock, service and transition assertions passed locally. The first sandbox run hit a temporary-directory permission boundary; rerunning in an isolated workspace temp directory passed all 33.
- Actual home and meeting-room renderers: 2 themes × 4 seasons × 2 surfaces = 16 passing cases, zero page-script errors, isolated fictional islands, no paid model calls or user-save edits.
- Delayed native region and missing region: 4 passing worker/compatible-loader cases; the previous complete view remained displayed. Cold pan and theme replacement: 4 additional passing cases.
- All 98 base-region borders per non-summer season were visually reviewed, along with final local repair crops and building-overlaid whole-island composites. These checks are terrain integration evidence, not perfect art or full-product acceptance.
- V186 deployment run [38623050961](https://github.com/MkaliezZ/hyper-dimension/actions/runs/38623050961) completed 9/9 successfully. V187 Windows/macOS cloud results must be checked on its own commit.

Run `npm run test:season-terrain` for the native loading and actual-renderer checks. They create isolated fixture data. Native screenshots are diagnostic evidence, not a performance claim for every machine.

## Remaining scope / 后续范围

Building roofs retain their existing art; seasonal roof variants and interior season decoration are not part of this terrain update. Proper nighttime lighting, moon reflections, richer residence interiors, physical cross-device Agent tests and the updated promotional video still require separate work. The current README video retains its stated V169/source-fragment versions.

本次完成整岛四季地形接入；屋顶四季素材、室内季节装饰、完整昼夜灯光和月影、住宅内部玩法、跨设备真人Agent联调及新宣传视频仍需继续。
