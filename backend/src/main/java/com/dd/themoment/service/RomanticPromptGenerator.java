package com.dd.themoment.service;

import com.dd.themoment.entity.AssociativeQuestion;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RomanticPromptGenerator {

    private static final Map<String, String> PROMPT_MAP = new HashMap<>();

    static {
        PROMPT_MAP.put("杯子", "你最后一次用这个杯子喝的什么饮品？还记得那时的心情吗？");
        PROMPT_MAP.put("书架", "这些书里，有没有某一本在特殊的时刻陪伴过你？");
        PROMPT_MAP.put("床", "今晚，你会在这里做什么样的梦呢？");
        PROMPT_MAP.put("窗户", "从这个窗户看出去，你最想看到的风景是什么？");
        PROMPT_MAP.put("植物", "你多久给它浇一次水？它见证过你多少个清晨？");
        PROMPT_MAP.put("落地灯", "这个灯光下，你最喜欢读哪本书？");
        PROMPT_MAP.put("沙发", "这张沙发陪你度过了哪些安静的时光？");
        PROMPT_MAP.put("茶几", "茶几上最常见的那件小物，代表了什么心情？");
        PROMPT_MAP.put("镜子", "你在镜子前是否曾有过一个特别的瞬间？");
        PROMPT_MAP.put("书桌", "这张书桌见证过你哪些重要决定？");
    }

    public List<AssociativeQuestion> generateQuestions(List<String> keyObjects) {
        List<AssociativeQuestion> questions = new ArrayList<>();
        if (keyObjects == null || keyObjects.isEmpty()) {
            keyObjects = List.of("床", "窗户", "植物");
        }
        for (String objectName : keyObjects) {
            String prompt = PROMPT_MAP.getOrDefault(objectName, "这个物品对你来说有什么特殊的意义？");
            questions.add(new AssociativeQuestion(UUID.randomUUID().toString(), objectName, prompt));
        }
        return questions;
    }
}
