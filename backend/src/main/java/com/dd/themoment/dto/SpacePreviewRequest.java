package com.dd.themoment.dto;

import java.util.List;

public class SpacePreviewRequest {
    private List<String> imageUrls;

    public SpacePreviewRequest() {
    }

    public List<String> getImageUrls() {
        return imageUrls;
    }

    public void setImageUrls(List<String> imageUrls) {
        this.imageUrls = imageUrls;
    }
}
