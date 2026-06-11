package com.dd.themoment.controller;

import com.dd.themoment.config.OpenCVProperties;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/opencv")
public class OpenCVController {

    // 用完全限定名避免 okhttp3.MediaType 和 Spring MediaType 冲突
    private static final okhttp3.MediaType IMAGE_MEDIA_TYPE = okhttp3.MediaType.parse("image/jpeg");
    private static final org.springframework.http.MediaType SPRING_JSON = org.springframework.http.MediaType.APPLICATION_JSON;

    private final OpenCVProperties properties;
    private final OkHttpClient httpClient;
    private final File tempDir;

    public OpenCVController(OpenCVProperties properties) throws IOException {
        this.properties = properties;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .writeTimeout(900, TimeUnit.SECONDS)
                .readTimeout(900, TimeUnit.SECONDS)
                .build();

        // 临时文件目录
        String userDir = System.getProperty("user.dir");
        Path tempPath = Path.of(userDir, "backend", "uploads", "opencv-temp");
        tempPath.toFile().mkdirs();
        this.tempDir = tempPath.toFile();
    }

    @PostMapping(value = "/upload", produces = "application/json")
    public ResponseEntity<String> upload(@RequestParam("images") MultipartFile[] files) {
        if (files.length < 12) {
            return ResponseEntity.badRequest()
                    .contentType(SPRING_JSON)
                    .body("{\"error\":\"至少需要 12 张图片进行全景拼接，当前收到 " + files.length + " 张\"}");
        }

        // 1. 保存上传的文件到临时目录
        File[] tempFiles = new File[files.length];
        try {
            for (int i = 0; i < files.length; i++) {
                String uuid = UUID.randomUUID().toString();
                String ext = getExtension(files[i].getOriginalFilename());
                File dest = new File(tempDir, uuid + "." + ext);
                files[i].transferTo(dest);
                tempFiles[i] = dest;
            }
        } catch (IOException e) {
            cleanup(tempFiles);
            return ResponseEntity.internalServerError()
                    .contentType(SPRING_JSON)
                    .body("{\"error\":\"保存上传文件失败: " + e.getMessage() + "\"}");
        }

        // 2. 构建 MultipartBody 请求 Python 服务
        String serviceUrl = properties.getServiceUrl();
        if (serviceUrl == null || serviceUrl.isBlank()) {
            cleanup(tempFiles);
            return ResponseEntity.internalServerError()
                    .contentType(SPRING_JSON)
                    .body("{\"error\":\"OpenCV 服务未配置\"}");
        }

        MultipartBody.Builder multipartBuilder = new MultipartBody.Builder()
                .setType(MultipartBody.FORM);

        for (File file : tempFiles) {
            RequestBody fileBody = RequestBody.create(file, IMAGE_MEDIA_TYPE);
            multipartBuilder.addFormDataPart("images", file.getName(), fileBody);
        }

        MultipartBody requestBody = multipartBuilder.build();
        Request request = new Request.Builder()
                .url(serviceUrl + "/stitch")
                .post(requestBody)
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                cleanup(tempFiles);
                String errBody = response.body() != null ? response.body().string() : "未知错误";
                return ResponseEntity.status(response.code())
                        .contentType(SPRING_JSON)
                        .body("{\"error\":\"OpenCV 服务返回错误: " + errBody + "\"}");
            }

            String responseBody = response.body() != null ? response.body().string() : "{}";

            // 3. 清理临时文件
            cleanup(tempFiles);

            // 4. 返回 Python 服务的响应
            return ResponseEntity.ok()
                    .contentType(SPRING_JSON)
                    .body(responseBody);

        } catch (IOException e) {
            cleanup(tempFiles);
            return ResponseEntity.status(503)
                    .contentType(SPRING_JSON)
                    .body("{\"error\":\"OpenCV 服务不可达: " + e.getMessage() + "\"}");
        }
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "jpg";
        return filename.substring(filename.lastIndexOf(".") + 1);
    }

    private void cleanup(File[] files) {
        if (files == null) return;
        for (File f : files) {
            if (f != null && f.exists()) {
                f.delete();
            }
        }
    }
}
