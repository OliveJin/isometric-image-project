# 📁 TheMoment 项目目录结构

```
TheMoment/
│
├── 📄 package.json                 # 项目配置和依赖
├── 📄 package-lock.json            # 依赖锁定文件
├── 📄 vite.config.js               # Vite 构建配置
├── 📄 index.html                   # 主入口 HTML
├── 📄 .gitignore                   # Git 忽略配置
├── 📁 .git/                        # Git 版本控制
│
├── 📁 src/                         # 前端源代码目录
│   ├── 📄 main.js                  # 前端主入口文件
│   │
│   ├── 📁 api/                     # 前端 API 通信
│   │   └── 📄 spaceApi.js          # 空间 API 调用
│   │
│   ├── 📁 audio/                   # 音频处理模块
│   │   ├── 📄 ambient.js           # 环境音效
│   │   └── 📄 player.js            # 音频播放器
│   │
│   ├── 📁 components/              # 前端组件目录
│   │   └── (组件文件存放处)
│   │
│   ├── 📁 hotspots/                # 热点交互模块
│   │   ├── 📄 hotspot.js           # 热点基础类
│   │   ├── 📄 audioPoint.js        # 音频热点
│   │   └── 📄 textPoint.js         # 文本热点
│   │
│   ├── 📁 scene/                   # 3D 场景管理
│   │   ├── 📄 scene.js             # 场景初始化
│   │   ├── 📄 sphere.js            # 全景球体
│   │   ├── 📄 camera.js            # 相机控制
│   │   ├── 📄 controls.js          # 用户交互控制
│   │   ├── 📄 loader.js            # 资源加载器
│   │   └── 📄 entrySpheres.js      # 入口球体
│   │
│   ├── 📁 ui/                      # 用户界面模块
│   │   ├── 📄 create.js            # 创建界面
│   │   ├── 📄 overlay.js           # 覆盖层组件
│   │   ├── 📄 selector.js          # 选择器
│   │   └── 📄 transition.js        # 转场效果
│   │
│   └── 📁 utils/                   # 前端工具函数
│       └── 📄 helpers.js           # 辅助函数
│
├── 📁 server/                      # 后端服务目录
│   ├── 📄 server.js                # 服务器入口
│   │
│   ├── 📁 api/                     # 后端 API 路由
│   │   ├── 📄 generate360.js       # 全景图生成接口
│   │   └── 📄 space.js             # 空间管理接口
│   │
│   ├── 📁 services/                # 业务逻辑服务
│   │   ├── 📄 aiService.js         # AI 服务
│   │   └── 📄 panoGenerator.js     # 全景图生成服务
│   │
│   ├── 📁 utils/                   # 后端工具函数
│   │   └── 📄 fileHelper.js        # 文件处理工具
│   │
│   ├── 📁 upload/                  # 文件上传处理
│   │   └── 📄 upload.js            # 上传逻辑
│   │
│   └── 📁 test/                    # 后端测试
│       └── (测试文件存放处)
│
├── 📁 public/                      # 静态资源目录
│   └── 📁 assets/                  # 资源文件
│       ├── 📁 audio/               # 音频资源
│       │   ├── 📁 ambient/         # 环境音乐
│       │   ├── 📁 voice/           # 语音文件
│       │   └── 📁 temp/            # 临时音频
│       │
│       ├── 📁 icons/               # 图标资源
│       │
│       ├── 📁 panoramas/           # 全景图资源
│       │   ├── 📁 demo/            # 示例全景图
│       │   ├── 📁 generated/       # 生成的全景图
│       │   ├── 📄 opencv.jpg       # OpenCV 示例
│       │   └── 📄 room1.jpg        # 房间示例
│       │
│       └── 📁 textures/            # 纹理资源
│
├── 📁 data/                        # 数据存储目录
│   ├── 📄 moments.json             # 时刻数据
│   └── 📄 spaces.json              # 空间数据
│
├── 📁 dist/                        # 构建输出目录（自动生成）
│   └── (打包后的文件)
│
└── 📁 node_modules/                # 依赖包目录（自动生成）
    └── (所有 npm 包)
```

---

## 📊 目录说明

### 根目录文件
- **package.json** - 项目配置，包含依赖和脚本命令
- **vite.config.js** - Vite 打包工具配置
- **index.html** - 应用主入口页面

### 📂 前端 (`src/`)
- **main.js** - 应用启动入口
- **api/** - API 调用层
- **audio/** - 音频播放功能
- **components/** - UI 组件
- **hotspots/** - 交互热点
- **scene/** - Three.js 3D 场景
- **ui/** - 用户界面
- **utils/** - 工具函数

### 📂 后端 (`server/`)
- **server.js** - Express 服务器启动
- **api/** - RESTful API 路由
- **services/** - 业务逻辑实现
- **utils/** - 工具函数
- **upload/** - 文件上传处理
- **test/** - 测试用例

### 📂 静态资源 (`public/`)
- **audio/** - 音频文件
- **icons/** - 图标文件
- **panoramas/** - 全景图（demo 和生成的）
- **textures/** - 3D 纹理

### 📂 数据 (`data/`)
- **moments.json** - 用户创建的时刻数据
- **spaces.json** - 空间配置数据

---

## 🔧 主要技术栈

### 前端
- **Vite** - 前端构建工具
- **Three.js** - 3D 图形库（用于全景球体显示）
- **JavaScript ES6** - 核心语言

### 后端
- **Express.js** - Web 框架
- **Multer** - 文件上传中间件
- **Node.js** - 运行时环境

### 工具
- **CORS** - 跨域资源共享
- **fs-extra** - 文件系统操作
- **uuid** - 唯一标识生成

---

## 🚀 主要功能模块

### 1. 全景图生成 (Panorama Generation)
```
前端上传图片 → 后端处理 → 生成 360° 投影图 → 存储到 public/assets/panoramas/generated
```

### 2. 3D 场景展示 (3D Scene Rendering)
```
加载全景图 → Three.js 球体映射 → 相机控制 → 热点交互
```

### 3. 音频播放 (Audio Playback)
```
环境音效 → 热点语音 → 播放器控制
```

### 4. 用户交互 (User Interaction)
```
创建空间 → 添加热点 → 编辑内容 → 保存数据
```

---

## 📝 文件类型统计

| 类型 | 目录 | 文件数 |
|------|------|--------|
| JavaScript | src/ | 14 |
| JavaScript | server/ | 8 |
| JSON | data/ | 2 |
| Static | public/ | (资源文件) |
| Config | 根目录 | 3 |

---

## 💾 存储位置说明

| 内容 | 位置 | 用途 |
|------|------|------|
| 源代码 | src/ 和 server/ | 开发编辑 |
| 构建输出 | dist/ | 生产部署 |
| 依赖包 | node_modules/ | 运行时依赖 |
| 配置数据 | data/ | 永久存储 |
| 图片资源 | public/assets/ | 静态文件服务 |
| 生成的全景图 | public/assets/panoramas/generated/ | 用户生成的内容 |

---

## 🔄 数据流向

```
用户界面 (src/ui/)
    ↓
API 调用 (src/api/)
    ↓
后端路由 (server/api/)
    ↓
业务逻辑 (server/services/)
    ↓
文件处理 (server/upload/)
    ↓
数据存储 (data/ 或 public/assets/)
    ↓
前端展示 (src/scene/)
```

---

**最后更新**: 2026-06-07  
**版本**: 1.0
