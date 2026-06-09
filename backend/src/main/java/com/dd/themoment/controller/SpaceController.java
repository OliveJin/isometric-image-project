package com.dd.themoment.controller;

import com.dd.themoment.dto.AssociativeQuestionDTO;
import com.dd.themoment.dto.CreateSpaceRequest;
import com.dd.themoment.dto.SpaceDTO;
import com.dd.themoment.dto.SpacePreviewDTO;
import com.dd.themoment.dto.SpacePreviewRequest;
import com.dd.themoment.entity.AssociativeQuestion;
import com.dd.themoment.entity.Space;
import com.dd.themoment.service.DoubaoService;
import com.dd.themoment.service.ObjectExtractionService;
import com.dd.themoment.service.RomanticPromptGenerator;
import com.dd.themoment.service.SpaceService;
import com.dd.themoment.service.PromptExtractor;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/spaces")
public class SpaceController {

    private final SpaceService spaceService;
    private final ObjectExtractionService extractionService;
    private final RomanticPromptGenerator promptGenerator;
    private final DoubaoService doubaoService;
    private final ObjectMapper objectMapper;

    public SpaceController(
            SpaceService spaceService,
            ObjectExtractionService extractionService,
            RomanticPromptGenerator promptGenerator,
            DoubaoService doubaoService
    ) {
        this.spaceService = spaceService;
        this.extractionService = extractionService;
        this.promptGenerator = promptGenerator;
        this.doubaoService = doubaoService;
        this.objectMapper = new ObjectMapper();
    }

    @GetMapping
    public List<SpaceDTO> listSpaces() {
        return spaceService.listSpaces().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @GetMapping("/{spaceId}")
    public ResponseEntity<SpaceDTO> getSpace(@PathVariable String spaceId) {
        return spaceService.getSpace(spaceId)
                .map(space -> ResponseEntity.ok(toDTO(space)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<SpaceDTO> createSpace(@RequestBody CreateSpaceRequest request) {
        if (request == null || request.getName() == null || request.getName().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        Space space = spaceService.createSpace(
                request.getName(),
                request.getGeneratedImageUrl(),
                request.getQuestions()
        );
        return ResponseEntity.ok(toDTO(space));
    }

    @PostMapping("/{spaceId}/questions/{questionId}/answer")
    public ResponseEntity<Void> answerQuestion(
            @PathVariable String spaceId,
            @PathVariable String questionId,
            @RequestBody AssociativeQuestionDTO request
    ) {
        if (request == null || request.getUserAnswer() == null) {
            return ResponseEntity.badRequest().build();
        }

        return spaceService.updateAnswer(spaceId, questionId, request.getUserAnswer())
                .map(question -> ResponseEntity.ok().<Void>build())
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping(value = "/preview", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<SpacePreviewDTO> previewSpace(@RequestBody SpacePreviewRequest request) {
        List<String> imageUrls = request == null ? List.of() : request.getImageUrls();
        List<String> objects = extractionService.extractKeyObjects(imageUrls);
        List<AssociativeQuestion> questions = promptGenerator.generateQuestions(objects);
        String generatedImageUrl = imageUrls != null && !imageUrls.isEmpty() ? imageUrls.get(0) : null;

        if (generatedImageUrl != null && !generatedImageUrl.isBlank()) {
            try {
                String visionResult = doubaoService.analyzeImages(imageUrls);
                String prompt = PromptExtractor.extractSeedreamPrompt(visionResult);
                if (prompt != null && !prompt.isBlank()) {
                    String result = doubaoService.generateImage(prompt, imageUrls);
                    String url = extractImageUrl(result);
                    if (url != null && !url.isBlank()) {
                        generatedImageUrl = url;
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        List<AssociativeQuestionDTO> questionDTOs = questions.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(new SpacePreviewDTO(generatedImageUrl, questionDTOs));
    }

    private String extractImageUrl(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            if (root.has("data") && root.get("data").isArray() && root.get("data").size() > 0) {
                JsonNode first = root.get("data").get(0);
                if (first.has("url")) {
                    return first.get("url").asText();
                }
                if (first.isTextual()) {
                    return first.asText();
                }
            }
            if (root.has("url")) {
                return root.get("url").asText();
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private SpaceDTO toDTO(Space space) {
        return new SpaceDTO(
                space.getId(),
                space.getName(),
                space.getGeneratedImageUrl(),
                space.getCreatedAt(),
                space.getQuestions().stream().map(this::toDTO).collect(Collectors.toList())
        );
    }

    private AssociativeQuestionDTO toDTO(AssociativeQuestion question) {
        return new AssociativeQuestionDTO(
                question.getId(),
                question.getObjectName(),
                question.getQuestion(),
                question.getUserAnswer(),
                question.getPositionX(),
                question.getPositionY()
        );
    }
}
