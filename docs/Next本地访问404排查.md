# 本地访问 localhost:3001 出现 404 / _next 静态资源 404

## 现象说明

- 地址栏访问 `http://localhost:3001/` 返回 **404**  
- 控制台出现 `react-refresh.js?ts=...`、`main.js?ts=...`、`_app.js?ts=...` 等 **404**

其中带 **`?ts=`** 的请求是 **`next dev`（开发模式）** 才会生成的脚本名。说明浏览器里的页面**期望连的是开发服务器**，但当前 **3001 端口上要么不是 Next，要么 Next 没在正确目录跑起来**，就会出现根路径和静态资源一起挂。

---

## 请按顺序排查

### 1. 必须在项目根目录启动

终端里先进入**本仓库根目录**（该目录下能看到 `package.json`、`pages`、`next.config.js`）：

```bat
cd D:\DEMO\fs_tt
```

不要在别的文件夹里执行 `next dev`。

### 2. 关掉占用 3001 的旧进程（EADDRINUSE）

**推荐（项目已配置）：** 在仓库根目录执行：

```bat
npm run free:3001
```

然后再 `npm run dev`。也可一条命令：

```bat
npm run dev:open
```

（会先尝试释放 3001，再启动开发服务器。）

**或手动（PowerShell）：**

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
```

### 3. 清缓存后重新开发模式（推荐）

```bat
cd D:\DEMO\fs_tt
npm run dev:reset
```

等价于：删除 `.next` 再执行 `npm run dev`。

### 4. 确认终端里 Next 已就绪

正常时应出现类似：

```text
ready started server on 0.0.0.0:3001, url: http://localhost:3001
```

若这里有 **报错 / 编译失败**，先把红字错误修掉再访问。

### 5. 浏览器侧

- 用 **无痕窗口** 打开 `http://127.0.0.1:3001`  
- 或 **强制刷新**（Ctrl+F5），避免沿用旧标签页里缓存的 HTML

---

## 开发与生产不要混用

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式，带热更新，`/_next/static/...?ts=...` |
| `npm run build` 然后 `npm run start` | 生产模式，带 hash 的 chunk，**没有** `react-refresh.js` |

- 用 **`npm run start`** 前**必须先** `npm run build`，且保证 `.next` 完整。  
- 不要在 **`start` 跑着的端口**上，却用之前 **`dev` 时期**缓存下来的页面去刷新（会乱请求资源）。

---

## 若仍 404

1. 终端执行：`curl http://127.0.0.1:3001/api/hello`  
   - 若也 404，说明 3001 上**不是**本项目的 Next。  
2. 确认没有其它工具（IIS、Nginx、内网穿透）把 3001 指到错误后端。

---

## 与本项目配置相关说明

- 静态导出 `output: 'export'` **仅**在运行 `npm run build:export` 时启用，**不会**在普通 `npm run dev` / `npm run build` 下生效。  
- 日常开发请始终使用：`set BUILD_MODE= && next dev`（即脚本里的 `npm run dev`）。
