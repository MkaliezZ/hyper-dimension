# V166 · Windows 时钟初始化锁 / Windows clock initialization lock

V165 同源码完整 CI 38258356754 的 Windows 规则任务 114842176850 在并发首次启动检查失败：environment-clock.json.lock 的 open('wx') 返回 EPERM，堆栈位于 environmentService.mjs:14。该失败来自时钟锁，农田原生任务在观察时仍在运行，不将两者混为同一结论。

时钟锁现在调用已有 openExclusiveFile：Windows EPERM / EACCES / EBUSY 仅作总计 680 ms 的有界等待，再失败则原样报错；保留 wx、0600、锁所有者、EEXIST 的现有互斥循环和五秒上限。没有删除正在占用的锁来取得所有权，也没有改动昼夜/四季数值或统一时钟协议。

22 项相关检查通过：环境与时钟 14 项、锁 8 项，包括实际 20 个并发首开、中央版本不得回退、旧本地季节迁移、临时/永久权限失败和实际竞争。V166 全平台 CI 另行核对，不能从这些检查推出 Windows/Mac 整体通过。

独立离线 945 项与双画风原生农田成功属于 V165 源码 438c30c0e4885142cc911cce2649cdbc392c66ec，V165 ZIP 保留不改。本机仍 V160、公开发布包仍 V158，完整 18R/28F/30T（4 完成/14 进行中）范围保持。

## English

V165 Windows CI failed its concurrent first-boot check with EPERM opening environment-clock.json.lock. The clock mutex now uses the existing bounded Windows exclusive-open retry helper. Exclusive flags, owner verification, EEXIST handling and the five-second mutex limit remain intact; clock values and protocol are unchanged. All 22 related checks passed locally. Full-platform verification is separate. The independently verified 945-check archive remains immutable V165; local V160 and public V158 stay current.
