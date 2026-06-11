package com.dd.themoment.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@RestController
public class ProxyController {

    private final HttpClient client = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    // 简单的图片代理，用于本地开发时绕过第三方图片的 CORS 限制
    @GetMapping("/api/proxy")
    public ResponseEntity<byte[]> proxy(@RequestParam("url") String url) throws Exception {
        if (url == null || url.isBlank() || !(url.startsWith("http://") || url.startsWith("https://"))) {
            return ResponseEntity.badRequest().body(new byte[0]);
        }

        URI targetUri = URI.create(url);

        HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
            .uri(targetUri)
            .GET()
            .timeout(Duration.ofSeconds(60))
            .header("Accept", "image/*, */*")
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36");

        // set Referer to the origin of the target to mimic browser behavior
        try {
            String origin = targetUri.getScheme() + "://" + targetUri.getHost();
            if (targetUri.getPort() != -1) origin += ":" + targetUri.getPort();
            reqBuilder.header("Referer", origin);
        } catch (Exception ignored) {
        }

        HttpResponse<byte[]> resp = client.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofByteArray());

        int status = resp.statusCode();
        byte[] body = resp.body();

        String contentType = resp.headers().firstValue("content-type").orElse(MediaType.APPLICATION_OCTET_STREAM_VALUE);

        // If remote returned 403/4xx, include a short diagnostic in logs
        if (status == 403) {
            System.out.println("Proxy fetched 403 for url: " + url);
        }

        return ResponseEntity.status(status)
            .contentType(MediaType.parseMediaType(contentType))
            .body(body);
    }

    // 下载外部图片并保存到本地 backend/uploads/ 目录，返回本地可访问路径 /uploads/{filename}
    @GetMapping("/api/fetch-and-save")
    public ResponseEntity<String> fetchAndSave(@RequestParam("url") String url) throws Exception {
        if (url == null || url.isBlank() || !(url.startsWith("http://") || url.startsWith("https://"))) {
            return ResponseEntity.badRequest().body("{}");
        }

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .timeout(Duration.ofSeconds(60))
                .build();

        HttpResponse<byte[]> resp = client.send(req, HttpResponse.BodyHandlers.ofByteArray());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            return ResponseEntity.status(resp.statusCode()).body("{}");
        }

        byte[] body = resp.body();
        String contentType = resp.headers().firstValue("content-type").orElse(MediaType.APPLICATION_OCTET_STREAM_VALUE);

        String ext = ".jpg";
        if (contentType.contains("png")) ext = ".png";
        else if (contentType.contains("webp")) ext = ".webp";
        else if (contentType.contains("jpeg") || contentType.contains("jpg")) ext = ".jpg";

        // 与 UploadController 保持一致：保存到 user.dir/backend/uploads/
        String userDir = System.getProperty("user.dir");
        String[] candidates = {
            userDir + java.io.File.separator + "backend" + java.io.File.separator + "uploads",
            userDir + java.io.File.separator + "uploads",
        };
        java.nio.file.Path uploadsDir = null;
        for (String candidate : candidates) {
            java.nio.file.Path p = java.nio.file.Paths.get(candidate);
            if (java.nio.file.Files.exists(p)) {
                uploadsDir = p;
                break;
            }
        }
        if (uploadsDir == null) {
            uploadsDir = java.nio.file.Paths.get("backend", "uploads");
            java.nio.file.Files.createDirectories(uploadsDir);
        }

        String filename = java.util.UUID.randomUUID().toString() + ext;
        java.nio.file.Path target = uploadsDir.resolve(filename);
        java.nio.file.Files.write(target, body);

        String localPath = "/uploads/" + filename;
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body("{\"url\":\"" + localPath + "\"}");
    }
}
