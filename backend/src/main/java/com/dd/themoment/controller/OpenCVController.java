package com.dd.themoment.controller;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.dd.themoment.service.OpenCVService;
import com.dd.themoment.service.OpenCVService.StitchException;
import com.dd.themoment.service.OpenCVService.StitchResult;

/**
 * 全景拼接 API —— 基于 JavaCV，无需外部 Python 服务
 */
@RestController
@RequestMapping("/api/opencv")
public class OpenCVController {

    private static final int MIN_IMAGES = 10;

    private final OpenCVService openCVService;
    private final Path tempDir;

    public OpenCVController(OpenCVService openCVService) throws IOException {
        this.openCVService = openCVService;

        String userDir = System.getProperty("user.dir");
        Path candidate1 = Paths.get(userDir, "backend", "uploads");
        Path candidate2 = Paths.get(userDir, "uploads");
        Path uploadsDir;
        if (Files.exists(candidate1) && Files.isDirectory(candidate1)) {
            uploadsDir = candidate1;
        } else if (Files.exists(candidate2) && Files.isDirectory(candidate2)) {
            uploadsDir = candidate2;
        } else {
            uploadsDir = candidate1;
        }
        Files.createDirectories(uploadsDir);
        this.tempDir = uploadsDir.resolve("opencv-temp");
        Files.createDirectories(tempDir);
    }

    /** 健康检查 */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("engine", "JavaCV (内置 OpenCV)");
        status.put("minImages", MIN_IMAGES);
        status.put("ready", true);
        status.put("tempDir", tempDir.toAbsolutePath().toString());
        return ResponseEntity.ok(status);
    }

    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> upload(
            @RequestParam("images") MultipartFile[] files) {

        if (files.length < MIN_IMAGES) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("error", "至少需要 " + MIN_IMAGES + " 张图片，当前收到 " + files.length + " 张"));
        }

        // 1. 保存上传文件到临时目录
        List<File> tempFiles = new ArrayList<>();
        try {
            for (MultipartFile file : files) {
                String ext = getExtension(file.getOriginalFilename());
                File dest = tempDir.resolve(UUID.randomUUID() + "." + ext).toFile();
                file.transferTo(dest);
                tempFiles.add(dest);
            }
        } catch (IOException e) {
            cleanup(tempFiles);
            return ResponseEntity.internalServerError()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("error", "保存上传文件失败: " + e.getMessage()));
        }

        // 2. 调用 JavaCV 拼接
        try {
            StitchResult result = openCVService.stitch(tempFiles);
            cleanup(tempFiles);

            return ResponseEntity.ok(Map.of(
                    "status", "ok",
                    "url", result.getUrl(),
                    "width", result.getWidth(),
                    "height", result.getHeight()
            ));

        } catch (StitchException e) {
            cleanup(tempFiles);
            return ResponseEntity.internalServerError()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "error", e.getMessage(),
                            "hint", "请确保：1) 图片有 30%-50% 重叠  2) 拍摄角度变化不要过大  3) 图片数量 ≥ " + MIN_IMAGES
                    ));
        }
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "jpg";
        return filename.substring(filename.lastIndexOf(".") + 1);
    }

    private void cleanup(List<File> files) {
        for (File f : files) {
            if (f != null && f.exists()) {
                f.delete();
            }
        }
    }
}
