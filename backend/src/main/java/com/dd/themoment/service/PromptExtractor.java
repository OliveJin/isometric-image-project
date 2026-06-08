package com.dd.themoment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public class PromptExtractor {

    public static String extractSeedreamPrompt(String visionJson) {

        try {

            ObjectMapper mapper =
                    new ObjectMapper();

            JsonNode root =
                    mapper.readTree(visionJson);

            JsonNode output =
                    root.path("output");

            for (JsonNode item : output) {

                JsonNode content =
                        item.path("content");

                if (!content.isArray()) {
                    continue;
                }

                for (JsonNode c : content) {

                    String text =
                            c.path("text").asText("");

                    System.out.println("===== 找到文本 =====");
                    System.out.println(text);

                    if (text.contains("seedream_generation_prompt")) {

                        JsonNode inner =
                                mapper.readTree(text);

                        String prompt =
                                inner.path("seedream_generation_prompt")
                                        .asText("");

                        System.out.println("===== Prompt提取成功 =====");
                        System.out.println(prompt);

                        return prompt;
                    }
                }
            }

        } catch (Exception e) {

            e.printStackTrace();
        }

        return "";
    }
}