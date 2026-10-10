# V158 · 标准 A2A 接口 / Standard A2A interface

## 能做什么 / What it does

外部 A2A 客户端现在可以发现 Hyper Dimension 管家服务、发送消息、查看和停止协作任务。它与会客厅「管家交流／活动协作」共用同一份账本、双方同意和原机路由。来访者仍使用自己的 Hermes 管家；已绑定原机时，回信转交原机，离线不会静默改用服务器管家。

An external A2A client can discover the steward service, send messages, inspect tasks and cancel ongoing cooperation. The standard transport uses the same correspondence ledger, consent checks and device routing as the lobby UI. A visitor keeps their own Hermes runtime; a bound device is used without an offline fallback to the game server.

| 接口 / Interface | 行为 / Behavior |
| --- | --- |
| `GET /.well-known/agent-card.json` | 公共能力卡，不含账号、同伴或私有文档 / Public capabilities without account or companion information |
| `POST /api/lan/a2a` | A2A 1.0 JSON-RPC，`A2A-Version: 1.0` / A2A 1.0 JSON-RPC |
| `GetExtendedAgentCard` | 本账号当前房间、可选对方管家、接收设置及本人活动 / Authenticated room, peers, consent and owned events |
| `SendMessage` | 交流或活动准备；默认等到回复或需要输入的状态 / Correspondence or preparation; blocking by default |
| `GetTask` / `ListTasks` | 仅双方可见，支持历史条数、状态与时间筛选、游标分页 / Participant-only history, filters and cursor pagination |
| `CancelTask` | 停止进行中的协作；晚到回信不能重开任务 / Cancel active cooperation; late replies cannot reopen it |

内容类型使用 `application/a2a+json` 或 `application/json`。响应为 `application/a2a+json`。仅接受文字，不下载文件、URL 或通知回调。能力卡明确不提供流式和推送通知。本机／受信局域网的现有运行端使用 HTTP；这不是公网部署或代理配置方案。

Requests accept `application/a2a+json` or `application/json`; responses use `application/a2a+json`. This text interface does not fetch files, URLs or callback endpoints. Streaming and push notifications are advertised as unavailable. The existing local/trusted-LAN listener uses HTTP; this is not a public hosting or reverse-proxy deployment guide.

## 登录与房间 / Authentication and room

使用现有 `/api/lan/login` 登录取得 `hd_lan_session` 的 HttpOnly cookie。标准接口接受该 cookie，也接受同一个岛主会话值的 Bearer 认证；原机桥接凭据不是岛主会话，不能代替。账号、会话和密钥均保持私有，不放入能力卡、文档、公开日志或源码包。

Log in through `/api/lan/login` and retain its `hd_lan_session` HttpOnly cookie privately. The standard interface accepts that cookie or the same owner session as a Bearer credential. A device bridge credential is not an owner session. Do not put credentials in public cards, logs or source packages.

双方必须位于同一会客房，并分别在「管家交流」开启信息接收；活动准备使用独立的协作同意。只有一位对方管家时，普通文字可自动选中该对方；多位时通过下述扩展指定目标。关闭接收、离岛、房间关闭或30分钟约定到期后，保留往来记录并停止后续执行。

Both owners must share the room and independently enable correspondence. Event preparation has separate consent. Plain text can address the sole peer; multiple peers require explicit selection through the extension below. Revoking consent, departure, room closure or the 30-minute expiry stops further work while retaining the transcript.

## 岛屿扩展 / Island extension

扩展 URI / Extension URI:

`https://mkaliezz.github.io/hyper-dimension/a2a/island-cooperation/v1`

这是稳定的协议标识，含义定义在本节。可在 `message.metadata[URI]` 或请求 `metadata[URI]` 放置同一个对象。两处同时提供时必须相同。能力卡和任务也在这个 URI 下返回游戏相关参数。

This is a stable identifier defined here. Put its object in `message.metadata[URI]` or request `metadata[URI]`; if both are supplied they must match. Cards and tasks expose the corresponding game parameters under this URI.

| 字段 / Field | 用途 / Purpose |
| --- | --- |
| `recipientId` | 扩展卡中当前同房间的目标岛主 / Target owner from the extended card |
| `capability` | `island.information`（默认/default）或/or `event.checkin` |
| `eventId` | 活动准备必须为本人活动、对方已受邀 / Preparation requires an owned event with that invitee |
| `action` | 接续任务时 `respond`、`review`、`retry`、`confirm`；预留必须明确 `execute` / Follow-up operation; reservation requires explicit `execute` |

新请求必须有唯一 `messageId`、`ROLE_USER` 和非空文字（合计最多500字）。接续时设置 `taskId`；若附带 `contextId`，须匹配原房间。重复同一消息编号和内容不会再启动模型或预留物资；改内容必须换编号。传输用的 JSON-RPC `id` 只关联响应，可以复用。

A new request needs a unique `messageId`, `ROLE_USER` and nonempty text, up to 500 characters total. Continue with `taskId`; an optional `contextId` must match its room. Replaying the same message and content does not invoke the model or reserve resources again. Changed content needs a new message ID. JSON-RPC `id` is only response correlation and may be reused.

任务状态遵循 `TASK_STATE_*`。本轮管家回信后可能是 `TASK_STATE_INPUT_REQUIRED`，等待对方岛主继续，不会冒充整个活动已办成。`configuration.returnImmediately=true` 可先取得工作中任务；默认等待完成、失败、取消或需要输入。`historyLength=0` 不返回历史，未指定时返回本任务保留的历史。旧内部协议任务没有标准输入记录，因此其历史仅包含已保存的管家回信。

States use `TASK_STATE_*`. A reply can leave the task in `TASK_STATE_INPUT_REQUIRED` for the other owner, not claim that a whole party is completed. `configuration.returnImmediately=true` returns a working task; the default waits for a terminal or interrupted state. `historyLength=0` omits history; an omitted limit returns retained history. Legacy internal-protocol tasks have saved steward replies but no standard client-input history.

活动准备顺序：主岛提出 → 来访管家审阅 → 来访岛主明确 `action=execute` → 受保护活动账本核对并预留 → 主岛管家确认回执。普通“同意”的文字不会自动扣取物资。这里完成的是入场准备，实际活动交付和收益仍由活动结束结算。正在核对物资或已结束的任务不可取消；这不会隐藏已经发生的账本操作。

Preparation follows offer → visiting steward review → explicit visiting-owner `action=execute` → protected activity reservation → host steward receipt confirmation. Merely saying “I agree” does not spend resources. Completion here confirms entry preparation; delivery and rewards remain in the activity settlement. A resource execution in progress or terminal task cannot be canceled, and existing ledger effects remain visible.

## 原始请求示例 / Wire example

凭据从私有会话取得，此处没有真实账号或密钥 / Supply authentication privately; no real account or credential is shown.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "SendMessage",
  "params": {
    "message": {
      "messageId": "replace-with-new-unique-message-id",
      "role": "ROLE_USER",
      "parts": [{"text": "请介绍本岛工坊，并与来访管家讨论合作活动。"}]
    },
    "configuration": {"returnImmediately": true}
  }
}
```

## 验证 / Verification

- [标准接口测试](../tests/v158-a2a-standard.test.mjs)：真实 HTTP、隔离账号和模拟运行时，检查身份隔离、双方同意、版本、内容类型、重复消息、阻塞/非阻塞、晚到回复、重启、分页、唯一物资预留以及绑定原机路由。
- [官方客户端测试](../tests/v158-a2a-sdk.mjs)：真实 `@a2a-js/sdk@1.3.0`，使用发现而非手写替代客户端，模拟模型。
- [真实管家测试](../tests/v158-a2a-live.mjs)：官方客户端→两份真实 Hermes/DeepSeek Flash→双画风原生交流界面→原生第三轮回信→标准任务查询与取消。两账户均从服务端新岛开始，没有注入进度或时钟。三次真实模型运行，重发不重复调用，刷新恢复记录，币和库存不变。
- 结果来自同一台 Windows 上的隔离进程。它们不是四台实体设备、Mac实机、陌生第三方运行时认证或多人真人验收，也不将 R16 标为完成。小游戏仍为占位演示，后续继续优化。

The HTTP tests use mock runtimes. The official-client test uses the real SDK with mock models. The live test uses two actual Hermes/DeepSeek Flash owner runtimes and native pixel/origami UI, including a third reply through the UI; three model runs, idempotent replay, refreshed history and unchanged resources were verified. These isolated processes ran on one Windows machine. This does not establish physical multi-device/Mac/human acceptance or authenticate arbitrary external runtimes, and does not complete R16.

公开精简结果 / Public summaries: [official client](verification/v158/official-sdk.json), [real Hermes and native UI](verification/v158/real-standard-a2a.json).

官方 SDK 在单独的测试目录安装，不是游戏运行依赖。运行测试时将 `HD_TEST_A2A_SDK` 设置为所安装 SDK 的 `dist/client/index.js` 文件 URL；真实测试还需私有模型配置与 Hermes 运行时。官方 SDK 使用生成的 ProtoJSON 类型，输入使用 `Message.fromJSON(...)` / `ListTasksRequest.fromJSON(...)` 构造；SDK 返回的枚举是数字，原始网络中的枚举是标准字符串。

Install the SDK in a separate test directory; it is not a game runtime dependency. Set `HD_TEST_A2A_SDK` to its installed `dist/client/index.js` file URL. The live check also needs privately configured models and Hermes. Use SDK ProtoJSON constructors for typed input; its in-memory enum values are numeric while the wire format uses the standard names.

## 依据 / References

接口按 [A2A v1.0.1 specification](https://github.com/a2aproject/A2A/blob/v1.0.1/docs/specification.md) 和 [normative protocol definitions](https://github.com/a2aproject/A2A/blob/v1.0.1/specification/a2a.proto) 实现；客户端核对使用 [official JavaScript SDK](https://github.com/a2aproject/a2a-js)。未实现的能力没有在卡中宣称提供。
