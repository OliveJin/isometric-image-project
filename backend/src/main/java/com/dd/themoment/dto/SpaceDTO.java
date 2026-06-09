package com.dd.themoment.dto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class SpaceDTO {
    private String id;
    private String name;
    private String generatedImageUrl;
    private LocalDateTime createdAt;
    private List<AssociativeQuestionDTO> questions = new ArrayList<>();

    public SpaceDTO() {
    }

    public SpaceDTO(String id, String name, String generatedImageUrl, LocalDateTime createdAt, List<AssociativeQuestionDTO> questions) {
        this.id = id;
        this.name = name;
        this.generatedImageUrl = generatedImageUrl;
        this.createdAt = createdAt;
        this.questions = questions != null ? questions : new ArrayList<>();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getGeneratedImageUrl() {
        return generatedImageUrl;
    }

    public void setGeneratedImageUrl(String generatedImageUrl) {
        this.generatedImageUrl = generatedImageUrl;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public List<AssociativeQuestionDTO> getQuestions() {
        return questions;
    }

    public void setQuestions(List<AssociativeQuestionDTO> questions) {
        this.questions = questions != null ? questions : new ArrayList<>();
    }
}
