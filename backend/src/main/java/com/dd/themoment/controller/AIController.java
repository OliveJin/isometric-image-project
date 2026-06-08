package com.dd.themoment.controller;

import com.dd.themoment.service.DoubaoService;
import com.dd.themoment.service.PromptExtractor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ai")
public class AIController {

    private final DoubaoService doubaoService;

    public AIController(
            DoubaoService doubaoService
    ) {
        this.doubaoService = doubaoService;
    }

    @PostMapping(value = "/analyze", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> analyze(
            @RequestBody List<String> imageUrls
    ) throws Exception {

        System.out.println("===== 接收到图片 =====");

        imageUrls.forEach(System.out::println);

        // Vision识别，多张图
        String visionResult =
                doubaoService.analyzeImages(
                        imageUrls
                );

        // 提取统一Prompt
        String prompt =
                PromptExtractor.extractSeedreamPrompt(
                        visionResult
                );

        System.out.println(
                "===== 提取Prompt ====="
        );

        System.out.println(prompt);

        if(prompt == null || prompt.isBlank()){
            throw new RuntimeException(
                    "Prompt提取失败"
            );
        }

        // Seedream生图
        String result = doubaoService.generateImage(
                prompt,
                imageUrls
        );
        return ResponseEntity
                .ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(result);
    }
}