package com.dd.themoment.dto;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.Data;

/**
 * 空间数据模型 —— 前后端统一数据结构
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SpaceItem {
    private String id;
    private String panorama;
    private String label;

    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    private List<Map<String, Object>> hotspots = new ArrayList<>();

    private AudioInfo audio;

    // 前端元数据（localStorage 兼容），不参与序列化
    private transient boolean isLocal;
    private transient boolean isSaved;

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AudioInfo {
        private String bgm;
        private String mainAmbience;

        @JsonInclude(JsonInclude.Include.NON_EMPTY)
        private List<AmbienceItem> ambiences = new ArrayList<>();

        @JsonInclude(JsonInclude.Include.NON_EMPTY)
        private List<PointItem> guidePoints = new ArrayList<>();

        @JsonInclude(JsonInclude.Include.NON_EMPTY)
        private List<PointItem> voicePoints = new ArrayList<>();
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AmbienceItem {
        private String id;
        private String file;
        private String sector;
        private String text;
        private String fileName;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PointItem {
        private String id;
        private double[] position;
        private String text;
        private String ambienceId;
        private String file;
    }
}
