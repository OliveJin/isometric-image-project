package com.dd.themoment.controller;

import java.io.File;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/upload")
public class UploadController {

    private static final Set<String> ALLOWED_AUDIO_EXTENSIONS =
            Set.of(".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".wma", ".webm");

    /** 上传图片文件（多文件） */
    @PostMapping
    public List<String> upload(
            @RequestParam("files") MultipartFile[] files
    ) throws Exception {

        String uploadDir = resolveUploadDir();
        File dir = new File(uploadDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }

        List<String> imageUrls = new ArrayList<>();

        for (MultipartFile file : files) {
            String ext = getExtension(file.getOriginalFilename());
            String fileName = UUID.randomUUID() + ext;
            File dest = new File(dir, fileName);
            file.transferTo(dest);
            imageUrls.add("/uploads/" + fileName);
        }

        return imageUrls;
    }

    /** 上传单个音频文件 —— 返回可访问路径 */
    @PostMapping("/audio")
    public Map<String, String> uploadAudio(
            @RequestParam("file") MultipartFile file
    ) throws Exception {

        if (file.isEmpty()) {
            throw new IllegalArgumentException("音频文件为空");
        }

        String originalName = file.getOriginalFilename();
        String ext = getExtension(originalName).toLowerCase();

        if (!ALLOWED_AUDIO_EXTENSIONS.contains(ext)) {
            throw new IllegalArgumentException("不支持的音频格式: " + ext + "，支持: " + ALLOWED_AUDIO_EXTENSIONS);
        }

        String uploadDir = resolveUploadDir();
        String audioSubDir = uploadDir + File.separator + "audio";
        File dir = new File(audioSubDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }

        String fileName = UUID.randomUUID() + ext;
        File dest = new File(dir, fileName);
        file.transferTo(dest);

        String audioUrl = "/uploads/audio/" + fileName;
        System.out.println("[UploadController] 音频已保存: " + audioUrl + " (原名: " + originalName + ")");

        Map<String, String> result = new LinkedHashMap<>();
        result.put("url", audioUrl);
        result.put("fileName", originalName);
        result.put("size", String.valueOf(file.getSize()));
        return result;
    }

    // ========== helpers ==========

    private String resolveUploadDir() {
        String userDir = System.getProperty("user.dir");
        // 与 WebConfig 和 ProxyController 保持一致的目录查找
        String[] candidates = {
                userDir + File.separator + "backend" + File.separator + "uploads",
                userDir + File.separator + "uploads",
        };
        for (String candidate : candidates) {
            File f = new File(candidate);
            if (f.exists() && f.isDirectory()) {
                return candidate;
            }
        }
        return candidates[0]; // 默认
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return ".jpg";
        return filename.substring(filename.lastIndexOf(".")).toLowerCase();
    }
}