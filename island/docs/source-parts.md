# Agent 源码分卷 / Agent source parts

源码包包含双画风资源，可能超过单个发布附件的容量。分卷是普通 ZIP 的切片；先校验合并，再按 `AGENTS.md` 部署。无需安装器。

The dual-style source archive can exceed a single release attachment's capacity. Parts are slices of one ordinary ZIP. Verify and assemble them, then follow `AGENTS.md`; no installer is required.

GitHub 的[发布附件规则](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases#storage-and-bandwidth-quotas)要求每个附件小于 2 GiB；本工具默认每卷最多 1,000,000,000 字节。

GitHub's [release limits](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases#storage-and-bandwidth-quotas) require individual attachments below 2 GiB. The default part size is one billion bytes.

## 下载与合并 / Download and assemble

从同一条官方 Release 下载 `source-parts.json`、`source-parts.py` 和清单中的全部 `.part001`、`.part002` 等文件，放在同一目录。核对 Release 列出的源码提交与整包 SHA-256；不要混用不同版本的卷。

Download `source-parts.json`, `source-parts.py` and every listed `.part001`, `.part002`, etc. from the same official release into one directory. Check its published source commit and full-archive SHA-256. Keep versions separate.

Windows（Python 3.11+）：

```powershell
python source-parts.py assemble --manifest source-parts.json --output Hyper-Dimension-Source.zip
```

macOS / Ubuntu：

```sh
python3 source-parts.py assemble --manifest source-parts.json --output Hyper-Dimension-Source.zip
```

工具逐卷及整包校验 SHA-256，成功后输出 `passed: true` 的 JSON。缺卷、损坏或不一致时退出码为 1，不生成可用的完成包。已有不同内容的输出文件会保留，请选择新的输出路径。已有相同且校验通过的完整包可直接复用。

The tool checks every part and the full archive and emits JSON with `passed: true`. Missing or invalid parts fail with exit code 1. A different existing output is preserved; choose another output path. An existing verified copy is reused. The tool does not extract files, migrate saves or execute the game.

成功后解压 ZIP，把解压目录交给 Agent；先读取 `AGENTS.md`、`deploy.json` 和 `DEPLOYMENT.md`，再运行 `plan`、`doctor`、`setup`、`verify` 与 `run`。更新已有小岛时保留 `data/`、密钥与私有配置。

After success, extract the ZIP and give its directory to your Agent. Read `AGENTS.md`, `deploy.json` and `DEPLOYMENT.md`, then run `plan`, `doctor`, `setup`, `verify` and `run`. Preserve existing `data/`, keys and private configuration when updating.

## 生成发布卷 / Create release parts

维护者先冻结并校验源码 ZIP，再生成分卷。每卷默认不超过 1,000,000,000 字节，输入 ZIP 保留；同名冲突文件不会被覆盖。

Freeze and verify the source ZIP first. Each part defaults to at most 1,000,000,000 bytes. The input ZIP and conflicting existing files are preserved.

```sh
python tools/source-parts.py split --archive Hyper-Dimension-Source.zip --out-dir release-parts --source-commit FULL_40_CHARACTER_COMMIT
```

将当前仓库的 `tools/source-parts.py` 一并作为 Release 附件提供。清单校验用于完整性核对；发布来源与提交仍应通过官方仓库和 Release 核实。

Attach this repository's `tools/source-parts.py` to the release too. Checksums verify integrity; verify the publisher and source commit through the official repository and release.
