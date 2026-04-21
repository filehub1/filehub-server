# FileHub Server

基于 Node.js 和 React 构建的跨平台文件搜索与预览服务器。提供 Web 界面，支持即时文件搜索、预览和访问，局域网内任意浏览器均可使用。

## 功能特性

- **即时搜索** — 支持字符串、模糊、正则三种搜索模式，毫秒级响应
- **文件预览** — 支持 PDF、图片、视频、音频、Office 文档（xlsx/docx）、Markdown、代码高亮
- **局域网访问** — 将文件索引共享给同网络的其他设备
- **二维码** — 扫码即可在手机上打开
- **灵活配置** — 自定义索引目录和排除规则
- **深色/浅色主题**
- **REST API** — 所有功能均可通过 HTTP API 调用

## 环境要求

- Node.js 18+
- npm 9+

## 安装

### 方式一：Docker（推荐）

```bash
# 拉取并运行最新版本
docker pull exiahuang/filehub-server:latest
docker run -d -p 6543:6543 -v /你的数据目录:/data exiahuang/filehub-server:latest
```

然后在浏览器中打开 `http://localhost:6543`。

### 方式二：源码安装

```bash
git clone https://github.com/filehub1/filehub-server.git
cd filehub/server
npm install
npm run build
```

## 启动

```bash
# 启动服务器（默认端口 6543）
npm start

# 开发模式（热重载）
npm run dev

# 纯 Web 模式（不依赖 Electron）
npm run dev:web
```

## 配置

创建 `~/.filehub`（YAML 格式）：

```yaml
indexedDirectories:
  - /home/user/Documents
  - /home/user/Projects
serviceAddress: 0.0.0.0:6543
excludePatterns:
  - node_modules
  - .git
  - dist
  - "*.log"
```

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `indexedDirectories` | `string[]` | `[]` | 需要索引的目录列表 |
| `serviceAddress` | `string` | `0.0.0.0:6543` | 服务监听地址 |
| `uiAddress` | `string` | `0.0.0.0:6544` | 开发 UI 服务地址 |
| `excludePatterns` | `string[]` | `[]` | 跳过的文件/目录规则 |
| `useAdminMode` | `boolean` | `false` | 启用管理员模式 |

### 命令行参数覆盖

```bash
node dist/main/web-server.cjs --dir=/home/user/Documents
node dist/main/web-server.cjs --service-address=0.0.0.0:8080
```

## 使用方法

1. 浏览器打开 `http://localhost:6543`
2. 按 `/` 聚焦搜索框
3. 输入关键词，结果即时显示
4. 按 `Enter` 或 `l` 打开文件
5. 按 `o` 切换预览面板
6. 按 `\` 切换搜索模式（字符串 / 模糊 / 正则）

### 键盘快捷键

| 按键 | 功能 |
|------|------|
| `/` | 聚焦搜索框 |
| `j` / `↓` | 向下移动 |
| `k` / `↑` | 向上移动 |
| `Enter` / `l` | 打开文件 |
| `o` | 切换预览 |
| `O` | 在资源管理器中打开 |
| `\` | 切换搜索类型 |
| `r` | 重建索引 |
| `s` | 设置 |
| `?` | 帮助 |

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/search?query=&searchType=string` | GET | 搜索文件 |
| `/api/config` | GET | 获取当前配置 |
| `/api/config` | POST | 更新配置 |
| `/api/rebuild` | POST | 重建索引 |
| `/api/preview?path=` | GET | 获取文件预览 |
| `/api/status` | GET | 索引状态 |

## 构建原生插件（仅 Windows）

通过 Windows MFT/USN Journal 实现更快的索引速度：

```bash
cd src/addon
node-gyp configure
node-gyp build
```

## 许可证

MIT
