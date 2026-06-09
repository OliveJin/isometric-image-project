package com.dd.themoment.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/upload")
public class UploadController {

    @Value("${app.upload-base-url}")
    private String uploadBaseUrl;

    @PostMapping
    public List<String> upload(
            @RequestParam("files") MultipartFile[] files
    ) throws Exception {

        String uploadDir =
                System.getProperty("user.dir")
                        + File.separator
                        + "uploads";

        File dir = new File(uploadDir);

        if (!dir.exists()) {
            dir.mkdirs();
        }

        List<String> imageUrls =
                new ArrayList<>();

        String baseUrl = normalizeBaseUrl(uploadBaseUrl);

        for (MultipartFile file : files) {

            String fileName =
                    UUID.randomUUID() + ".jpg";

            File dest =
                    new File(dir, fileName);

            file.transferTo(dest);

            String imageUrl =
                    baseUrl + "/uploads/" + fileName;

            imageUrls.add(imageUrl);
        }

        return imageUrls;
    }

    private String normalizeBaseUrl(String url) {
        if (url == null) {
            return "";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}