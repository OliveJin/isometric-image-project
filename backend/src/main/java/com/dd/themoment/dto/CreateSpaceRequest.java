package com.dd.themoment.dto;

import java.util.List;

public class CreateSpaceRequest {
    private String name;
    private String generatedImageUrl;
    private List<AssociativeQuestionDTO> questions;

    public CreateSpaceRequest() {
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

    public List<AssociativeQuestionDTO> getQuestions() {
        return questions;
    }

    public void setQuestions(List<AssociativeQuestionDTO> questions) {
        this.questions = questions;
    }
}
