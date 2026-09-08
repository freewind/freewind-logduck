# Log Dog

本地持久化日志站。前端走 Vite，API 独立进程，靠 Vite proxy 暴露单端口。日志落盘为 JSONL 文件，按应用/版本/日期分目录存储，文件永不过期。

## 存储结构

```
data/
  <appName>/
    <version>/                                  # 数字版本号
      <appName>-<version>-YYYYMMDD.jsonl        # 每天一个文件
    __none__/                                   # 无 version 的日志归此目录
      <appName>-__none__-YYYYMMDD.jsonl
```

- 每条日志一行 JSON（JSONL），写入即 append，**旧文件永不删除**，保留长周期日志供检索/debug
- 日期取日志 `timestamp`（本地时间 `YYYYMMDD-HHmmss`）的前 8 位；第二天写入新文件
- 每行含服务端生成的 `_ms`（毫秒时间戳，同进程内单调递增），作为排序字段（日志按 `_ms` 倒序展示）；协议 timestamp 为秒级，同秒多条日志靠 `_ms` 区分先后
- 网页查询定位到单个文件后**全量读取返回**（无分页）；关键词/level 过滤在服务端扫描完成
- `data/` 已在 `.gitignore` 中

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

`version` 可选，类型 `number`，不带则落 `__none__` 目录。建议业务代码里维护 `logVersion` 数字，每次 commit 前自增 1，再随日志上报，便于 AI 判新旧。
`timestamp` 使用本地时间格式 `YYYYMMDD-HHmmss`。
`level` 支持：`debug | info | warn | error`。查询时按阈值语义，`info` 表示 `info/warn/error`，其余同理。

### 查日志（单文件全量）

定位唯一文件需要 `appName` + `version` + `date`：

- `appName`：必填
- `version`：可填数字或 `__none__`（无版本）；不传按 `__none__` 处理
- `date`：可选，格式 `YYYYMMDD`，不传默认今天
- `level`：阈值过滤，`debug/info/warn/error` 分别表示"该级别及以上"
- `messageKeyword` / `detailsKeyword`：可选，按 `message` / `details` include 过滤（大小写不敏感）
- `from` / `to`：可选，本地时间 `YYYYMMDD-HHmmss`
- `maxFieldLength`：单字段最大字符数，默认 `300`，传 `0` 表示完整返回
- 返回 `{ logs, total }`：该文件内过滤命中的**全量**日志，按 `_ms` 倒序（新在前）；文件不存在返回空结果

```bash
curl 'http://127.0.0.1:52742/api/logs?appName=demo-app&version=42&date=20260514&level=error&messageKeyword=login'
```

### 应用列表

返回 `data/` 下有日志的应用名（目录扫描，无统计数字）。

```bash
curl 'http://127.0.0.1:52742/api/apps'
# {"apps":["demo-app","smoke-app"]}
```

### 版本列表

返回指定应用下有日志的版本（目录名倒序：数字版本在前从大到小，`__none__` 殿后）。

```bash
curl 'http://127.0.0.1:52742/api/versions?appName=demo-app'
# {"versions":["43","42","__none__"]}
```

### 日期列表

返回指定应用+版本下有日志的日期（从文件名提取，倒序，最新在前）。Web 端三级下拉的日期选项即来自此。

```bash
curl 'http://127.0.0.1:52742/api/dates?appName=demo-app&version=42'
# {"dates":["20260909","20260908"]}
```

### 删单条

```bash
curl -X DELETE http://127.0.0.1:52742/api/logs/<id>
```

### 按筛选批量删

删除命中文件内的匹配行（读全部 → 过滤 → 原子重写）；文件删空后自动删除文件与空目录。

```bash
curl -X DELETE 'http://127.0.0.1:52742/api/logs?appName=demo-app&version=42&date=20260514&level=error'
```

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
