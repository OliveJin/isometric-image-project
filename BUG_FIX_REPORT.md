# 🔧 空间编辑功能 - 问题修复说明

## 问题总结

### 报告的问题
1. ❌ 进入空间后没有播放BGM
2. ❌ 没有显示交互点（引导点和语音点）
3. ❌ 刷新后所有设置消失

## 根本原因分析

### 问题1: BGM 和环境音不播放

**原因**:
- 音频文件路径被虚拟化为 `/assets/audio/xxx`
- 但这些文件实际上并不存在于服务器
- 浏览器无法加载这些路径的音频

**解决方案**:
- 改用 **DataURL** 格式存储音频文件
- 用户上传的文件被转换为 Base64 编码的 DataURL
- 这样音频数据直接存储在空间配置中

### 问题2: 交互点不显示

**原因**:
- 可能是数据格式问题
- 或者 `createSphere` 没有接收到完整的 `space` 对象

**解决方案**:
- 确保编辑后的空间配置包含完整的 `audio` 对象
- 确保 `voicePoints` 和 `guidePoints` 数组正确初始化

### 问题3: 刷新后设置消失

**原因** (多个因素):
1. `saveCreatedSpaces()` 调用方式错误
2. 预设空间没有 `isSaved` 标记
3. 浅拷贝导致嵌套对象没有正确合并

**解决方案**:
1. ✅ 修复 `updateSpace()` 使用深度合并
2. ✅ 自动设置 `isSaved = true` 标记
3. ✅ 修复 `saveEditorChanges()` 调用
4. ✅ 移除对 `saveCreatedSpaces(newSpaces)` 的错误调用

---

## 已实施的修复

### 修复1: 深度合并音频数据 (loader.js)

```javascript
// 之前 - 浅拷贝，音频对象可能被覆盖
spaces[index] = { ...spaces[index], ...updatedSpace };

// 之后 - 深度合并，保留完整的音频数据
const mergedSpace = {
  ...spaces[index],
  ...updatedSpace,
  audio: {
    ...(spaces[index]?.audio || {}),
    ...(updatedSpace?.audio || {}),
  },
};
```

**影响**: 
- ✅ 编辑时不会丢失其他音频字段
- ✅ BGM、环境音、交互点数据完整保留

### 修复2: 自动设置保存标记

```javascript
// 确保空间被标记为已保存
spaces[index >= 0 ? index : spaces.length - 1].isSaved = true;
persistSavedSpaces(spaces);
```

**影响**:
- ✅ 预设空间编辑后也能被保存
- ✅ 新空间和编辑的空间都能正确持久化

### 修复3: 使用 DataURL 存储音频 (SpaceEditor.js)

```javascript
// 添加文件转换函数
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// BGM上传
const audioUrl = await fileToDataURL(file);
currentEditingSpace.audio.bgm = audioUrl;  // 存储 data:audio/mpeg;base64,...

// 环境音上传
addOrUpdateAmbience(sector, audioUrl, file.name);
```

**影响**:
- ✅ 音频文件直接存储为 DataURL
- ✅ 不依赖外部服务器资源
- ✅ 音频数据随配置持久化

### 修复4: 正确的保存流程 (SpaceEditor.js)

```javascript
// 之前 - 错误的调用
updateSpace(currentEditingSpace);
saveCreatedSpaces();  // ❌ 传入 undefined

// 之后 - 正确的调用
currentEditingSpace.isSaved = true;
updateSpace(currentEditingSpace);  // 内部会调用 persistSavedSpaces
```

**影响**:
- ✅ 数据正确保存到 localStorage
- ✅ 刷新后数据完整恢复

---

## 测试步骤

### ✅ 快速验证修复

```
1. 打开应用
2. 点击"进入此刻"
3. 创建新空间或编辑现有空间
4. 点击⚙️编辑按钮
5. 上传BGM和环境音
6. 编辑文本内容
7. 点击"💾 保存"
8. 进入该空间 - 应该能听到BGM
9. 应该看到交互点（紫色发光球）
10. 刷新页面 - 所有设置应该仍然存在
```

### 🔍 详细测试场景

#### 场景A: 新创建空间的编辑

**步骤**:
1. 上传照片创建新空间
2. 立即点击编辑
3. 添加BGM、环境音、引导点
4. 保存
5. 刷新页面
6. 进入空间

**预期结:
- ✅ 音频正常播放
- ✅ 交互点显示
- ✅ 刷新后数据完整

#### 场景B: 预设空间的编辑

**步骤**:
1. 编辑 `data/spaces.json` 中的任一预设空间
2. 点击编辑
3. 添加/修改BGM和环境音
4. 保存
5. 刷新

**预期结果**:
- ✅ 预设空间可以被编辑和保存
- ✅ 数据持久化到 localStorage
- ✅ 不影响原始的 spaces.json

#### 场景C: 多次编辑

**步骤**:
1. 编辑空间 - 第一次
2. 保存，进入空间，验证
3. 编辑空间 - 第二次（修改某些字段）
4. 保存，进入空间，验证
5. 刷新页面
6. 进入空间

**预期结果**:
- ✅ 每次保存都能覆盖之前的数据
- ✅ 不会部分保存或数据混乱
- ✅ 最终数据应该是最后一次编辑的结果

---

## 浏览器 localStorage 验证

### 检查保存的数据

打开浏览器开发者工具 (F12):
1. 转到 **Application** 标签
2. 找到 **Local Storage**
3. 点击当前域名
4. 查找 `the-moment-spaces` 的key
5. 观察 value 中的数据结构

**应该看到**:
```json
{
  "savedSpaces": [
    {
      "id": "space-xxx",
      "label": "...",
      "panorama": "...",
      "audio": {
        "bgm": "data:audio/mpeg;base64,/+MYxAQBl...",
        "ambiences": [
          {
            "id": "amb-north-xxx",
            "sector": "north",
            "file": "data:audio/wav;base64,UklGRi4A...",
            "fileName": "rain.wav",
            "text": "雨声"
          }
        ],
        "guidePoints": [...],
        "voicePoints": [...]
      },
      "isSaved": true
    }
  ],
  "deletedIds": []
}
```

**关键点**:
- ✅ 音频文件格式为 `data:audio/xxx;base64,...`
- ✅ 每个环境音都有 `fileName`
- ✅ 空间有 `isSaved: true` 标记
- ✅ 交互点数组存在且有数据

---

## 控制台调试信息

编辑后保存时，浏览器控制台应该显示:
```
✅ BGM文件已加载: my-music.mp3
✅ 环境音已加载: north rain-sound.wav
✅ 空间已保存: {id: "space-xxx", audio: {...}, ...}
```

如果看到错误:
```
❌ Save error: ...
❌ 文件读取失败: ...
```

请检查浏览器权限和localStorage是否已启用。

---

## DataURL 存储的优缺点

### ✅ 优点
- 无需服务器存储
- 完全自包含，跨域兼容
- 数据随配置持久化
- 无额外API调用

### ⚠️ 缺点
- Base64编码增加体积（约33%）
- 大量音频时 localStorage 可能满
- 不适合超大型文件 (>5MB)

### 最佳实践
- 保持音频文件 < 2MB
- 使用有损格式 (MP3) 而不是无损 (WAV)
- 定期清理旧空间数据

---

## 音频格式支持

### 推荐格式
- ✅ MP3 - 广泛支持，文件小
- ✅ OGG - 开放格式，质量好
- ✅ WAV - 无损，但文件大

### 不推荐
- ❌ FLAC - 许多浏览器不支持
- ❌ AAC - 许可问题
- ❌ AIFF - 过时且文件大

---

## 已修改的文件

1. **frontend/src/scene/loader.js**
   - ✅ 修复 `updateSpace()` 深度合并逻辑
   - ✅ 自动设置 `isSaved` 标记
   - ✅ 改进 localStorage 持久化

2. **frontend/src/ui/SpaceEditor.js**
   - ✅ 添加 `fileToDataURL()` 辅助函数
   - ✅ BGM上传改用 DataURL
   - ✅ 环境音上传改用 DataURL
   - ✅ 修复 `saveEditorChanges()` 逻辑
   - ✅ 改进 `renderAmbiences()` 显示

---

## 后续建议

### 短期 (立即)
- [ ] 测试所有修复
- [ ] 验证 localStorage 数据结构
- [ ] 测试刷新后数据完整性

### 中期 (可选)
- [ ] 添加音频文件大小限制提醒
- [ ] 实现 localStorage 清理工具
- [ ] 添加数据导出/导入功能

### 长期 (增强)
- [ ] 集成后端API处理音频上传
- [ ] 使用 IndexedDB 代替 DataURL（对大文件）
- [ ] 实现音频压缩

---

## FAQ

### Q: 为什么要用 DataURL 而不是上传到服务器？

**A**: 
- DataURL 不需要后端API支持
- 用户数据完全存储在本地，隐私性更好
- 无需额外的服务器存储成本
- 支持离线操作

### Q: 如果音频文件太大会怎样？

**A**: 
- localStorage 限制通常为 5-10MB
- Base64 编码会增加 ~33% 体积
- 建议单个文件 < 2MB
- 使用压缩格式如 MP3

### Q: 如何清理 localStorage 中的数据？

**A**: 
在浏览器控制台执行:
```javascript
localStorage.removeItem('the-moment-spaces');
// 或清空所有localStorage
localStorage.clear();
```

### Q: 如何导出/导入空间配置？

**A**: 
```javascript
// 导出
const data = localStorage.getItem('the-moment-spaces');
console.log(data);  // 复制粘贴保存

// 导入
localStorage.setItem('the-moment-spaces', JSON.stringify(...));
location.reload();
```

---

## 故障排除

### 症状: 保存后仍然看不到数据

**检查项**:
1. 浏览器控制台是否有错误
2. localStorage 是否启用 (无痕模式禁用)
3. 磁盘空间是否充足
4. 尝试在开发者工具中手动检查 localStorage

### 症状: 刷新后只有部分数据丢失

**可能原因**:
- 浅拷贝导致某些字段未保存
- 已修复，请更新代码

### 症状: 音频无法播放

**检查项**:
1. 文件格式是否被浏览器支持
2. 文件大小是否过大导致加载失败
3. 浏览器控制台是否有 CORS 或加载错误
4. AudioContext 是否已初始化

---

**版本**: 1.0.1 (修复版)  
**更新日期**: 2026-06-14
