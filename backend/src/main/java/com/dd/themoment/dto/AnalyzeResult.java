package com.dd.themoment.dto;

import lombok.Data;

@Data
public class AnalyzeResult {
    private String imageUrl;
    private String prompt;
    private String generatedImage; // Doubao生图返回JSON
}