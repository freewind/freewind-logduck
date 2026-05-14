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

`format` 参数：

- `toon`：默认值，适合给 AI / 省 token
- `json`：适合网页或普通程序直接消费

时间过滤参数：

- `from`：起始本地时间，格式 `YYYYMMDD-HHmmss`
- `to`：结束本地时间，格式 `YYYYMMDD-HHmmss`

```bash
curl 'http://127.0.0.1:52742/api/logs?appName=demo-app&level=error&from=20260514-100000&to=20260514-110000&limit=20'
```

等价于：

```bash
curl 'http://127.0.0.1:52742/api/logs?appName=demo-app&level=error&from=20260514-100000&to=20260514-110000&limit=20&format=toon'
```

若要 JSON：

```bash
curl 'http://127.0.0.1:52742/api/logs?appName=demo-app&level=error&from=20260514-100000&to=20260514-110000&limit=20&format=json'
```

### 删单条

```bash
curl -X DELETE http://127.0.0.1:52742/api/logs/<id>
```

### 按筛选批量删

```bash
curl -X DELETE 'http://127.0.0.1:52742/api/logs?appName=demo-app&level=error'
```
