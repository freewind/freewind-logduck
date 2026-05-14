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

默认返回 TOON。

若要 JSON：

```bash
curl 'http://127.0.0.1:52742/api/logs?appName=demo-app&level=error&limit=20&format=json'
```

### 删单条

```bash
curl -X DELETE http://127.0.0.1:52742/api/logs/<id>
```

### 按筛选批量删

```bash
curl -X DELETE 'http://127.0.0.1:52742/api/logs?appName=demo-app&level=error'
```
