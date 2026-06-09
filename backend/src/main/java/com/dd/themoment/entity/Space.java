package com.dd.themoment.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class Space {
    private String id;
    private String name;
    private String generatedImageUrl;
    private LocalDateTime createdAt;
    private List<AssociativeQuestion> questions = new ArrayList<>();

    public Space() {
    }

    public Space(String id, String name, String generatedImageUrl, LocalDateTime createdAt, List<AssociativeQuestion> questions) {
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

    public List<AssociativeQuestion> getQuestions() {
        return questions;
    }

    public void setQuestions(List<AssociativeQuestion> questions) {
        this.questions = questions != null ? questions : new ArrayList<>();
    }
}
