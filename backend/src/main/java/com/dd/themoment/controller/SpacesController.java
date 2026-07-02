package com.dd.themoment.controller;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dd.themoment.dto.SpaceItem;
import com.dd.themoment.service.SpaceService;

/**
 * 空间存储 REST API
 * 提供空间数据的完整 CRUD 操作，数据持久化到服务端 JSON 文件
 */
@RestController
@RequestMapping("/api/spaces")
public class SpacesController {

    private final SpaceService spaceService;

    public SpacesController(SpaceService spaceService) {
        this.spaceService = spaceService;
    }

    /** 获取所有空间 */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<SpaceItem>> listSpaces() {
        return ResponseEntity.ok(spaceService.listAll());
    }

    /** 获取单个空间 */
    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<SpaceItem> getSpace(@PathVariable String id) {
        Optional<SpaceItem> item = spaceService.getById(id);
        return item.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** 创建新空间 */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE,
                 produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<SpaceItem> createSpace(@RequestBody SpaceItem space) {
        if (space.getPanorama() == null || space.getPanorama().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        SpaceItem created = spaceService.create(space);
        return ResponseEntity.ok(created);
    }

    /** 更新空间（部分更新） */
    @PutMapping(value = "/{id}",
                consumes = MediaType.APPLICATION_JSON_VALUE,
                produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<SpaceItem> updateSpace(
            @PathVariable String id,
            @RequestBody SpaceItem updates) {
        Optional<SpaceItem> updated = spaceService.update(id, updates);
        return updated.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** 删除空间 */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteSpace(@PathVariable String id) {
        boolean deleted = spaceService.delete(id);
        if (deleted) {
            return ResponseEntity.ok(Map.of("success", true, "id", id));
        }
        return ResponseEntity.notFound().build();
    }

    /** 获取存储统计 */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        return ResponseEntity.ok(spaceService.getStats());
    }
}
