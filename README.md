# Log Dog

内存日志站。前端走 Vite，API 独立进程，靠 Vite proxy 暴露单端口。

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
    "version": "20260515-120000",
    "timestamp": "20260514-100000",
    "level": "debug",
    "message": "login failed",
    "details": "stack..."
  }'
```

`version` 必填，类型 `string`。建议直接用安装包/构建产物时间戳，格式同 `timestamp`，便于快速判断日志新旧。
`timestamp` 使用本地时间格式 `YYYYMMDD-HHmmss`。
`level` 支持：`debug | info | warn | error`

### 查日志

时间过滤参数：

- `from`：起始本地时间，格式 `YYYYMMDD-HHmmss`
- `to`：结束本地时间，格式 `YYYYMMDD-HHmmss`
- `maxFieldLength`：单字段最大字符数，默认 `300`，传 `0` 表示完整返回
- 返回顺序：旧的在前；网页 table 默认反向显示，最新在前

```bash
curl 'http://127.0.0.1:52742/api/logs?appName=demo-app&level=error&from=20260514-100000&to=20260514-110000&limit=20&maxFieldLength=300'
```

### 版本哨兵约定

为避免旧安装/旧包日志混进来造成误判，发送端接入时统一加这条约定：

- 每条日志都带 `version`
- `version` 推荐直接写构建或安装时间戳，如 `20260515-120000`
- 程序启动后立刻发 1 条 `warn` 日志，`message` 固定写 `__log_dog_version_warning__`
- 这条 `warn` 的 `version` 必须等于当前安装版本；`details` 可补充渠道、git sha、包名
- AI 取日志时先看最近这条固定 warning，再决定当前拿到的是新安装还是旧安装残留

示例：

```bash
curl -X POST http://127.0.0.1:52742/api/logs \
  -H 'content-type: application/json' \
  -d '{
    "appName": "demo-app",
    "version": "20260515-120000",
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

### 删单条

```bash
curl -X DELETE http://127.0.0.1:52742/api/logs/<id>
```

### 按筛选批量删

```bash
curl -X DELETE 'http://127.0.0.1:52742/api/logs?appName=demo-app&level=error'
```
