# AgentFlow Studio Frontend

Next.js 15 通用智能体工作流编排台。

## Scripts

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd exec tsc -- --noEmit
```

默认请求后端：

```text
http://localhost:8000
```

可通过环境变量覆盖：

```powershell
$env:NEXT_PUBLIC_API_BASE_URL="http://localhost:8000"
```

## Main Files

- `app/page.tsx` - AgentFlow Studio 通用场景画布
- `app/globals.css` - 全局样式和 React Flow 细节
