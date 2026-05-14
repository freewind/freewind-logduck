# Log Dog

内存日志站。前端看日志，API 收日志/查日志/删日志。

## 运行

```bash
pnpm install
pnpm dev
```

服务默认监听 `http://0.0.0.0:52742`。

## API

### 写日志

```bash
curl -X POST http://127.0.0.1:52742/api/logs \
  -H 'content-type: application/json' \
  -d '{
    "appName": "demo-app",
    "timestamp": "2026-05-14T10:00:00.000Z",
    "level": "error",
    "message": "login failed",
    "details": "stack..."
  }'
```

### 查日志

```bash
curl 'http://127.0.0.1:52742/api/logs?appName=demo-app&level=error&limit=20'
```

### 删单条

```bash
curl -X DELETE http://127.0.0.1:52742/api/logs/<id>
```

### 按筛选批量删

```bash
curl -X DELETE 'http://127.0.0.1:52742/api/logs?appName=demo-app&level=error'
```
