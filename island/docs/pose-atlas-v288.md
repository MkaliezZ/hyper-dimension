# Shared character pose surfaces / 共享角色动作画布

Walking and tool actions keep the original connected character mesh, 64-step interpolation, texture sampling and native pose dimensions. Cached poses now occupy transparent rectangles on shared Canvas pages instead of retaining a separate Canvas for every pose. The page budget remains 64 MiB; a single exact-size workspace preserves the original paint origin. Interpolation pins its first pose while obtaining the second, and an unavailable allocation keeps the original drawing fallback.

相同动作使用共享图集页，减少持续行走时保留的画布数量。页面按最近使用顺序回收，旧页释放底层尺寸；画风切换仍清空旧动作缓存。该改动不调整 NPC 决策频率、动作时长、资源收益、存档身份、海浪或地图清晰度。

## Evidence and limits

- Five resource-lifecycle checks cover thousands of poses, reuse, clipping, page eviction, interpolation pinning, oversized fallback and clearing. Nine existing character mesh/raster checks also pass.
- Native Windows comparisons use the actual pixel/origami character PNGs, walking and three tool actions, four phases and three backing scales. All 192 original/candidate image pairs match exactly. An earlier direct-to-page candidate differed at a joint edge; the exact-origin workspace corrects that difference without relaxing the comparison.
- Four simultaneous Windows maps rendered for 120 real seconds before ordinary reload. The original and candidate both pass their original 30-second reload/map-ready limits. Before reload, the original retains roughly three thousand nonzero canvases per page; the candidate retains roughly twenty. This is a backing-count observation, not proof of lower total GPU memory: page padding can use more allocated bytes.
- Hosted ARM macOS diagnostic run `39135956467`, job `117700393025`, passes the unchanged sequential resident task, mid-chain reload and empty-browser reopen test in both styles. Actual Canvas acceleration and `ANGLE_METAL`, original 1440×1000 viewport/backing, original 120/240-second working budgets, ocean WebGL2 and all task/receipt assertions remain. The candidate artifact SHA-256 is `d4e64c4642ba05ed916920bcc3b70597b38b920a8f90e40f27e722c7035a009b`; its official digest and every ZIP CRC were checked.
- The same-run original renderer fails after mid-chain reload with native Metal/Canvas and the unchanged test. Its official artifact SHA-256 is `3415f8ddf166687c858f142c34c5ed06b243bafa436378198471068630ae583c`; the full digest and all CRCs were checked. The candidate passes this comparison, while the regular platform matrix, other Mac failures, physical Mac acceptance and human play quality remain separately tracked.
- The complete release-source default rule script passes 1466 checks (1452 domain checks plus 14 maintenance checks), with no failure, cancellation or skip. This is automated source verification, not a complete delivery or human acceptance.
- The previous full four-map/original-device A2A journey still has an unresolved mid-activity reload timeout. Ordinary reload and a separate funded-checkpoint recovery control pass on original V287; neither substitutes for finishing that complete journey on the release source.

No private saves, provider credentials, document contents, recordings or runtime directories are part of this change. The source package remains an Agent deployment artifact; the prior V287 ZIP and its completed Windows installation proof retain their original version.
