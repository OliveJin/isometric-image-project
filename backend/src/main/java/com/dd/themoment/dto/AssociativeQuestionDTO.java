package com.dd.themoment.dto;

public class AssociativeQuestionDTO {
    private String id;
    private String objectName;
    private String question;
    private String userAnswer;
    private Integer positionX;
    private Integer positionY;

    public AssociativeQuestionDTO() {
    }

    public AssociativeQuestionDTO(String id, String objectName, String question, String userAnswer, Integer positionX, Integer positionY) {
        this.id = id;
        this.objectName = objectName;
        this.question = question;
        this.userAnswer = userAnswer;
        this.positionX = positionX;
        this.positionY = positionY;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getObjectName() {
        return objectName;
    }

    public void setObjectName(String objectName) {
        this.objectName = objectName;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getUserAnswer() {
        return userAnswer;
    }

    public void setUserAnswer(String userAnswer) {
        this.userAnswer = userAnswer;
    }

    public Integer getPositionX() {
        return positionX;
    }

    public void setPositionX(Integer positionX) {
        this.positionX = positionX;
    }

    public Integer getPositionY() {
        return positionY;
    }

    public void setPositionY(Integer positionY) {
        this.positionY = positionY;
    }
}
