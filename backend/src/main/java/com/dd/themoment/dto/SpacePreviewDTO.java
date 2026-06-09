package com.dd.themoment.dto;

import java.util.ArrayList;
import java.util.List;

public class SpacePreviewDTO {
    private String generatedImageUrl;
    private List<AssociativeQuestionDTO> questions = new ArrayList<>();

    public SpacePreviewDTO() {
    }

    public SpacePreviewDTO(String generatedImageUrl, List<AssociativeQuestionDTO> questions) {
        this.generatedImageUrl = generatedImageUrl;
        this.questions = questions != null ? questions : new ArrayList<>();
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
        this.questions = questions != null ? questions : new ArrayList<>();
    }
}
