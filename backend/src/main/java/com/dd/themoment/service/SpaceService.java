package com.dd.themoment.service;

import com.dd.themoment.dto.SpaceItem;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 空间数据持久化服务 —— JSON 文件存储
 * 数据文件位置：user.dir/data/spaces.json（与前端 data/spaces.json 格式兼容）
 */
@Service
public class SpaceService {

    private final ObjectMapper objectMapper = new ObjectMapper()
            .enable(SerializationFeature.INDENT_OUTPUT);

    /** 内存缓存：id -> SpaceItem */
    private final Map<String, SpaceItem> store = new ConcurrentHashMap<>();

    /** 已删除的空间 ID 集合 */
    private final Set<String> deletedIds = ConcurrentHashMap.newKeySet();

    private Path storagePath;

    @PostConstruct
    public void init() {
        String userDir = System.getProperty("user.dir");
        // 尝试多个候选路径（兼容 IDE 直接运行和 mvn spring-boot:run）
        List<Path> candidates = List.of(
                Paths.get(userDir, "data", "spaces.json"),
                Paths.get(userDir, "..", "data", "spaces.json"),
                Paths.get(userDir, "backend", "..", "data", "spaces.json")
        );
        for (Path p : candidates) {
            try {
                Path normalized = p.toRealPath();
                if (Files.exists(normalized)) {
                    storagePath = normalized;
                    break;
                }
            } catch (IOException ignored) {
            }
        }
        if (storagePath == null) {
            // 默认使用第一个候选路径
            storagePath = Paths.get(userDir, "data", "spaces.json");
            try {
                Files.createDirectories(storagePath.getParent());
            } catch (IOException e) {
                throw new RuntimeException("无法创建存储目录: " + storagePath.getParent(), e);
            }
        }

        System.out.println("[SpaceService] 存储路径: " + storagePath.toAbsolutePath());
        loadFromDisk();
    }

    /** 从磁盘加载所有空间数据 */
    private synchronized void loadFromDisk() {
        if (!Files.exists(storagePath)) {
            System.out.println("[SpaceService] 存储文件不存在，从空开始");
            return;
        }
        try {
            List<SpaceItem> items = objectMapper.readValue(
                    storagePath.toFile(),
                    new TypeReference<List<SpaceItem>>() {}
            );
            store.clear();
            for (SpaceItem item : items) {
                if (item.getId() != null) {
                    store.put(item.getId(), item);
                }
            }
            System.out.println("[SpaceService] 已加载 " + store.size() + " 个空间");
        } catch (IOException e) {
            System.err.println("[SpaceService] 加载失败: " + e.getMessage());
        }
    }

    /** 持久化到磁盘 */
    private synchronized void saveToDisk() {
        try {
            Files.createDirectories(storagePath.getParent());
            List<SpaceItem> items = new ArrayList<>(store.values());
            objectMapper.writeValue(storagePath.toFile(), items);
            System.out.println("[SpaceService] 已保存 " + items.size() + " 个空间");
        } catch (IOException e) {
            System.err.println("[SpaceService] 保存失败: " + e.getMessage());
            throw new RuntimeException("空间数据保存失败", e);
        }
    }

    // ==================== CRUD ====================

    /** 获取所有空间（排除已删除的） */
    public List<SpaceItem> listAll() {
        return store.values().stream()
                .filter(item -> !deletedIds.contains(item.getId()))
                .collect(Collectors.toList());
    }

    /** 获取单个空间 */
    public Optional<SpaceItem> getById(String id) {
        SpaceItem item = store.get(id);
        if (item == null || deletedIds.contains(id)) {
            return Optional.empty();
        }
        return Optional.of(item);
    }

    /** 创建新空间 */
    public SpaceItem create(SpaceItem item) {
        if (item.getId() == null || item.getId().isBlank()) {
            item.setId("space-" + System.currentTimeMillis() + "-" +
                    UUID.randomUUID().toString().substring(0, 8));
        }
        deletedIds.remove(item.getId());
        store.put(item.getId(), item);
        saveToDisk();
        System.out.println("[SpaceService] 创建空间: " + item.getId());
        return item;
    }

    /** 更新空间（合并更新） */
    public Optional<SpaceItem> update(String id, SpaceItem updates) {
        SpaceItem existing = store.get(id);
        if (existing == null || deletedIds.contains(id)) {
            return Optional.empty();
        }

        // 合并字段
        if (updates.getPanorama() != null) existing.setPanorama(updates.getPanorama());
        if (updates.getLabel() != null) existing.setLabel(updates.getLabel());
        if (updates.getHotspots() != null) existing.setHotspots(updates.getHotspots());

        // 音频信息深度合并
        if (updates.getAudio() != null) {
            if (existing.getAudio() == null) {
                existing.setAudio(new SpaceItem.AudioInfo());
            }
            SpaceItem.AudioInfo src = updates.getAudio();
            SpaceItem.AudioInfo dst = existing.getAudio();

            if (src.getBgm() != null) dst.setBgm(src.getBgm());
            if (src.getAmbiences() != null) dst.setAmbiences(src.getAmbiences());
            if (src.getGuidePoints() != null) dst.setGuidePoints(src.getGuidePoints());
            if (src.getVoicePoints() != null) dst.setVoicePoints(src.getVoicePoints());
        }

        store.put(id, existing);
        saveToDisk();
        System.out.println("[SpaceService] 更新空间: " + id);
        return Optional.of(existing);
    }

    /** 删除空间（软删除） */
    public boolean delete(String id) {
        if (!store.containsKey(id)) {
            return false;
        }
        deletedIds.add(id);
        store.remove(id);
        saveToDisk();
        System.out.println("[SpaceService] 删除空间: " + id);
        return true;
    }

    /** 获取统计信息 */
    public Map<String, Object> getStats() {
        return Map.of(
                "totalSpaces", store.size(),
                "deletedCount", deletedIds.size()
        );
    }
}
