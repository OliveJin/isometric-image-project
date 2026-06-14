# The Moment

> 360° 全景空间体验 —— 拍照导入，即刻进入沉浸式等距空间

## 简介

The Moment 是一款基于等距三维场景的 360° 全景空间浏览器。用户通过上传照片，可以：

- **本地即时贴图**（1 张）：选择一张 equirectangular（等距柱状投影）全景图，直接在本地浏览器中创建沉浸式空间，**无需后端**。
- **AI 合成全景图**（恰好 4 张）：选择 4 张不同角度的室内照片，后端通过火山引擎 ARK / Seedream AI 识别场景并生成对应的全景图，自动创建空间。
- **OpenCV 全景拼接**（10 张以上）：选择 10+ 张重叠拍摄的照片，后端通过 OpenCV 自动拼接成一张 360° 全景图。

所有创建的空间数据保存在浏览器 `localStorage` 中，支持创建、重命名、删除。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vite 4 + Vanilla JS (ES Modules) + Three.js 0.128 |
| 后端 | Spring Boot 3.5.14 (Java 17) + Lombok + OkHttp |
| AI | 火山引擎 ARK (doubao-seed-2-0-pro 视觉识别 + doubao-seedream-5-0 生图) |
| 全景拼接 | 外部 OpenCV Python 服务 (`http://localhost:5000`) |

**端口分配：**

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 Vite dev server | `3000` | 主界面 |
| 后端 Spring Boot | `8080` | 上传、AI 分析、图片代理 |
| OpenCV Python 服务 | `5000` | 全景拼接（可选） |

---

## 快速开始

### 前置要求

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | 18+ | 前端开发服务器 |
| JDK | 17+ | 后端 Spring Boot 运行 |
| Maven | 3.8+ | 后端构建工具 |

### 安装步骤

#### 1. 克隆仓库

```bash
git clone https://github.com/OliveJin/isometric-image-project.git
cd isometric-image-project
```

#### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端将运行在 `http://localhost:3000`，打开浏览器访问即可。

#### 3. 启动后端

```bash
cd backend
# Windows 使用：
mvn.cmd spring-boot:run
# 或者在 IDEA / VS Code 中直接运行 ThemomentApplication.java
```

后端将运行在 `http://localhost:8080`。

> **注意：** 前后端需要同时运行。前端通过 Vite proxy 将 `/api` 和 `/uploads` 请求转发到后端的 8080 端口。

---

## 配置说明

### 后端配置 (`backend/src/main/resources/application.yaml`)

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 500MB       # 单文件最大 500MB
      max-request-size: 500MB

ark:
  api-key: <你的火山引擎 ARK API Key>    # 必须配置
  seedream-model: doubao-seedream-5-0-260128

opencv:
  service-url: http://localhost:5000     # OpenCV 拼接服务地址（可选）
```

- **`ark.api-key`**：调用 AI 分析和生图功能**必填**。前往 [火山引擎控制台](https://console.volcengine.com/ark) 创建 API Key。
- **`opencv.service-url`**：使用全景拼接功能时需要。该服务为一个独立的 Python Flask/FastAPI 服务，监听 5000 端口。

### 前端配置 (`frontend/vite.config.js`)

```js
proxy: {
  '/api': {
    target: 'http://localhost:8080',
  },
  '/uploads': {
    target: 'http://localhost:8080',
  }
}
```

如果后端端口不是 8080，请修改此处。

---

## 功能详解

### 1. 本地即时贴图 (1 张照片)

- **无需后端**，纯浏览器本地处理
- 选择 1 张 equirectangular 全景图即可创建空间
- 使用 Three.js SphereGeometry 映射到内球面

### 2. AI 合成全景图 (恰好 4 张照片)

**流程：**

1. 用户在前端选择 **恰好 4 张** 不同角度的室内照片
2. 照片上传到后端 `/api/upload`
3. 后端调用火山引擎 ARK 视觉模型分析 4 张照片，提取房间布局信息
4. 生成 Seedream Prompt，调用 Seedream 模型生成全景图
5. 后端下载生成的图片并保存到 `backend/uploads/` 目录
6. 前端创建对应的 360° 空间

**API 接口：**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload` | 上传图片，返回 `/uploads/{filename}` 列表 |
| POST | `/api/ai/analyze` | AI 分析 + 生图，接收图片 URL 数组 |
| GET | `/api/proxy?url=...` | 图片代理（绕过 CORS） |
| GET | `/api/fetch-and-save?url=...` | 下载外部图片到本地 |
| GET | `/uploads/{filename}` | 访问已上传/生成的图片 |

### 3. OpenCV 全景拼接 (10+ 张照片)

**前置条件：** 需要启动一个 OpenCV Python 拼接服务（监听 5000 端口）。

**流程：**

1. 用户在前端选择 **10 张以上** 重叠拍摄的照片
2. 照片上传到后端 `/api/opencv/upload`
3. 后端将文件转发给 Python OpenCV 服务 `/stitch` 接口
4. Python 服务使用 OpenCV Stitcher 拼接全景图
5. 返回拼接结果 URL，后端代理访问

> 如果未启动 OpenCV 服务，此功能会返回 503 错误。

---

## 项目结构

```
isometric-image-project/
├── index.html                    # 入口 HTML（主界面）
├── data/
│   └── spaces.json               # 初始预设空间列表
├── frontend/                     # 前端项目
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js            # Vite 配置（端口、代理）
│   ├── src/
│   │   ├── main.js               # 主入口（初始化、UI 事件绑定）
│   │   ├── scene/
│   │   │   ├── scene.js          # Three.js 场景、相机、渲染器
│   │   │   ├── camera.js         # 相机控制
│   │   │   ├── sphere.js         # 360° 全景球体创建/清理
│   │   │   ├── loader.js         # 空间数据加载与 localStorage 持久化
│   │   │   └── entrySpheres.js   # 入口球体（空间列表）
│   │   └── ui/
│   │       └── selector.js       # 底部空间选择器渲染
│   └── public/
│       └── assets/panoramas/     # 预设全景图资源
├── backend/                      # Spring Boot 后端
│   ├── pom.xml
│   ├── src/main/java/com/dd/themoment/
│   │   ├── ThemomentApplication.java   # 启动类
│   │   ├── WebConfig.java              # 静态资源托管 + CORS
│   │   ├── config/
│   │   │   └── OpenCVProperties.java   # OpenCV 服务配置
│   │   ├── controller/
│   │   │   ├── UploadController.java   # 图片上传
│   │   │   ├── AIController.java       # AI 分析 + 生图
│   │   │   ├── OpenCVController.java   # OpenCV 拼接
│   │   │   └── ProxyController.java    # 图片代理 + 下载保存
│   │   ├── dto/
│   │   │   └── AnalyzeResult.java      # 分析结果 DTO
│   │   ├── service/
│   │   │   ├── DoubaoService.java      # 火山引擎 ARK 调用
│   │   │   └── PromptExtractor.java    # Prompt 解析器
│   │   └── config/
│   │       └── GlobalExceptionHandler.java
│   ├── src/main/resources/
│   │   └── application.yaml            # 配置文件
│   └── uploads/                        # 图片存储目录（自动创建）
└── README.md
```

---

## 数据持久化

- **前端空间数据**：存储在浏览器 `localStorage`（key: `the-moment-spaces`）
- **后端图片文件**：存储在 `backend/uploads/` 目录，按 UUID 命名
- **预设数据**：`data/spaces.json` 中的空间在每次启动时加载（与 localStorage 合并）

---

## 常见问题 (FAQ)

**Q: 打开 `http://localhost:3000` 页面空白或无法操作？**

- 确认后端 Spring Boot 已启动并运行在 8080 端口
- 打开浏览器控制台（F12）检查是否有 CORS 错误或网络请求失败
- 确认 `frontend/vite.config.js` 中的代理 target 与后端端口一致

**Q: 上传照片后没有反应？**

- 检查照片数量：必须是 1 张、恰好 4 张、或 10 张以上
- 检查后端日志是否有报错（特别是 API Key 配置是否正确）

**Q: AI 合成失败？**

- 确认 `application.yaml` 中配置了有效的 `ark.api-key`
- 查看后端控制台日志，确认 API 返回格式正确

**Q: 全景拼接不可用？**

- 需要额外启动一个 Python OpenCV 服务监听 5000 端口
- 在 `application.yaml` 中确认 `opencv.service-url` 配置正确

**Q: 创建的空间消失了？**

- 空间数据存储在浏览器 `localStorage`，清除浏览器缓存会导致数据丢失
- 不同浏览器 / 不同隐身模式的数据互不影响

---

## 开发说明

- 前端使用 Vite 作为开发服务器和构建工具，`npm run dev` 启动热更新开发服务器
- 后端使用 Spring Boot DevTools 实现热重载
- 使用 Maven Wrapper（`mvnw` / `mvnw.cmd`）确保构建环境一致

---

## License

ISC
