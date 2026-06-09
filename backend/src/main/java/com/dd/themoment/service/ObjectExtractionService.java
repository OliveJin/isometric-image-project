package com.dd.themoment.service;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class ObjectExtractionService {

    private static final List<String> DEFAULT_OBJECTS = Arrays.asList(
            "床",
            "落地灯",
            "窗帘",
            "窗户",
            "书架",
            "植物",
            "沙发",
            "茶几",
            "镜子",
            "书桌"
    );

    public List<String> extractKeyObjects(List<String> imageUrls) {
        if (imageUrls == null || imageUrls.isEmpty()) {
            return DEFAULT_OBJECTS.subList(0, 3);
        }

        Set<String> found = new LinkedHashSet<>();
        for (String imageUrl : imageUrls) {
            String lower = imageUrl.toLowerCase();
            if (lower.contains("bed") || lower.contains("床")) {
                found.add("床");
            }
            if (lower.contains("window") || lower.contains("窗")) {
                found.add("窗户");
            }
            if (lower.contains("book") || lower.contains("书")) {
                found.add("书架");
            }
            if (lower.contains("lamp") || lower.contains("灯")) {
                found.add("落地灯");
            }
            if (lower.contains("plant") || lower.contains("植物")) {
                found.add("植物");
            }
            if (found.size() >= 3) {
                break;
            }
        }

        if (found.size() < 3) {
            for (String item : DEFAULT_OBJECTS) {
                if (found.size() >= 3) break;
                found.add(item);
            }
        }

        return new ArrayList<>(found).subList(0, Math.min(3, found.size()));
    }
}
