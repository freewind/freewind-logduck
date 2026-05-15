# Log Dog

内存日志站。前端走 Vite，API 独立进程，靠 Vite proxy 暴露单端口。

内存保留策略：

- 每个 `appName` 最多保留最新 `1000` 条日志
- 超出后自动丢最旧的，同 app 内不区分 `level`

## 运行

```bash
pnpm install
pnpm dev
```

对外入口 `http://127.0.0.1:52742`。
内部 API 默认 `127.0.0.1:52743`，仅给 Vite proxy 转发。

## API

### 写日志

```bash
curl -X POST http://127.0.0.1:52742/api/logs \
  -H 'content-type: application/json' \
  -d '{
    "appName": "demo-app",
    "version": 42,
    "timestamp": "20260514-100000",
    "level": "debug",
    "message": "login failed",
    "details": "stack..."
  }'
```

`version` 可选，类型 `number`。建议业务代码里维护 `logVersion` 数字，每次 commit 前自增 1，再随日志上报，便于 AI 判新旧。
`timestamp` 使用本地时间格式 `YYYYMMDD-HHmmss`。
`level` 支持：`debug | info | warn | error`。查询时按阈值语义，`info` 表示 `info/warn/error`，其余同理。

### 查日志

时间过滤参数：

- 网页 table 列名、展开详情、filter label 直接使用原始 key 名：`appName` `version` `versionGte` `messageKeyword` `detailsKeyword` `level` `range` `maxFieldLength`

- `from`：起始本地时间，格式 `YYYYMMDD-HHmmss`
- `to`：结束本地时间，格式 `YYYYMMDD-HHmmss`
- `version`：可选，按版本精确过滤
- `versionGte`：可选，按版本下限过滤，命中 `version >= versionGte`
- `messageKeyword`：可选，按 `message` include 过滤
- `detailsKeyword`：可选，按 `details` include 过滤
- `limit`：可选，仅 API 查询生效；网页默认全量读取
- `level`：阈值过滤，`debug/info/warn/error` 分别表示“该级别及以上”
- `maxFieldLength`：单字段最大字符数，默认 `300`，传 `0` 表示完整返回
- 返回顺序：旧的在前；网页 table 默认反向显示，最新在前

```bash
curl 'http://127.0.0.1:52742/api/logs?appName=demo-app&version=42&versionGte=40&messageKeyword=login&detailsKeyword=timeout&level=error&from=20260514-100000&to=20260514-110000&maxFieldLength=300'
```

返回：

- `logs`：命中日志
- `total`：命中总数
- `apps`：当前命中结果里的 app 汇总
- 每个 `app` 项含 `appName` `count` `versions`
- 每个 `versions` 项含 `version` `count`
- AI 可直接读 `apps[].versions[]` 决定该拿哪个 app / version，不必再额外访问 `/api/apps`
- `versions`：当前命中结果里各 `version` 计数，可继续当 filter；AI 建议先看这里再缩小查询
- `versions` 排序：按数字倒序，新版本在前

### 版本哨兵约定

为避免旧安装/旧包日志混进来造成误判，发送端接入时统一加这条约定：

- 最好每条日志都带 `version`
- `version` 推荐直接写业务侧维护的 `logVersion` 数字，如 `42`
- 推荐把 `logVersion` 常量写在代码里，每次 commit 前自增 `1`
- 程序启动后立刻发 1 条 `warn` 日志，`message` 固定写 `__log_dog_version_warning__`
- 若带 `version`，这条 `warn` 的 `version` 必须等于当前安装版本；`details` 可补充渠道、git sha、包名
- AI 取日志时先看最近这条固定 warning，再决定当前拿到的是新安装还是旧安装残留

示例：

```bash
curl -X POST http://127.0.0.1:52742/api/logs \
  -H 'content-type: application/json' \
  -d '{
    "appName": "demo-app",
    "version": 42,
    "timestamp": "20260515-120001",
    "level": "warn",
    "message": "__log_dog_version_warning__",
    "details": "channel=android-debug git=abc123"
  }'
```

### 应用列表

返回所有 `appName`，以及每个 app 当前有多少条日志。

```bash
curl 'http://127.0.0.1:52742/api/apps'
```

### 版本列表

返回所有带 `version` 的版本值，以及每个版本当前有多少条日志。

```bash
curl 'http://127.0.0.1:52742/api/versions'
```

### 删单条

```bash
curl -X DELETE http://127.0.0.1:52742/api/logs/<id>
```

### 按筛选批量删

```bash
curl -X DELETE 'http://127.0.0.1:52742/api/logs?appName=demo-app&level=error'
```
