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
    "timestamp": "20260514-100000",
    "level": "debug",
    "message": "login failed",
    "details": "stack..."
  }'
```

`timestamp` 使用本地时间格式 `YYYYMMDD-HHmmss`。
`level` 支持：`debug | info | warn | error`

### 查日志

时间过滤参数：

- `from`：起始本地时间，格式 `YYYYMMDD-HHmmss`
- `to`：结束本地时间，格式 `YYYYMMDD-HHmmss`
- `maxFieldLength`：单字段最大字符数，默认 `100`，传 `0` 表示完整返回

```bash
curl 'http://127.0.0.1:52742/api/logs?appName=demo-app&level=error&from=20260514-100000&to=20260514-110000&limit=20&maxFieldLength=100'
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
