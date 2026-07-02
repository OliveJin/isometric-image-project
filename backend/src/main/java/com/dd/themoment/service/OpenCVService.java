package com.dd.themoment.service;

import org.bytedeco.opencv.global.opencv_core;
import org.bytedeco.opencv.global.opencv_imgcodecs;
import org.bytedeco.opencv.global.opencv_imgproc;
import org.bytedeco.opencv.global.opencv_stitching;
import org.bytedeco.opencv.opencv_core.Mat;
import org.bytedeco.opencv.opencv_core.MatVector;
import org.bytedeco.opencv.opencv_core.Rect;
import org.bytedeco.opencv.opencv_core.Size;
import org.bytedeco.opencv.opencv_stitching.Stitcher;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

/**
 * JavaCV 全景拼接服务 —— 替代 Python OpenCV 服务
 * 使用 org.bytedeco:opencv 直接在 JVM 内完成图片拼接
 */
@Service
public class OpenCVService {

    /** 拼接前将图片缩放到的最大宽度 */
    private static final int MAX_WIDTH = 1200;

    /** 输出目标尺寸 */
    private static final int TARGET_WIDTH = 2048;
    private static final int TARGET_HEIGHT = 1024;

    private Path uploadsDir;

    @PostConstruct
    public void init() throws IOException {
        // 与 WebConfig 保持一致的 uploads 目录查找
        String userDir = System.getProperty("user.dir");
        Path[] candidates = {
                Paths.get(userDir, "backend", "uploads"),
                Paths.get(userDir, "uploads"),
        };
        for (Path p : candidates) {
            if (Files.exists(p) && Files.isDirectory(p)) {
                uploadsDir = p;
                break;
            }
        }
        if (uploadsDir == null) {
            uploadsDir = Paths.get(userDir, "backend", "uploads");
        }
        Files.createDirectories(uploadsDir);
        System.out.println("[OpenCV] JavaCV 初始化完成，拼接目录: " + uploadsDir.toAbsolutePath());
    }

    /**
     * 执行全景拼接
     *
     * @param imageFiles 已保存到本地的图片文件列表
     * @return 拼接结果 { url, width, height }
     * @throws StitchException 拼接失败时抛出
     */
    public StitchResult stitch(List<File> imageFiles) throws StitchException {
        if (imageFiles.size() < 2) {
            throw new StitchException("至少需要 2 张图片，当前 " + imageFiles.size() + " 张");
        }

        // 1. 读取并缩放所有图片
        MatVector images = new MatVector(imageFiles.size());
        try {
            for (int i = 0; i < imageFiles.size(); i++) {
                Mat img = opencv_imgcodecs.imread(imageFiles.get(i).getAbsolutePath());
                if (img == null || img.empty()) {
                    releaseAll(images, i);
                    throw new StitchException("无法读取第 " + (i + 1) + " 张图片");
                }

                // 缩小大图加速拼接
                if (img.cols() > MAX_WIDTH) {
                    double scale = (double) MAX_WIDTH / img.cols();
                    int newH = (int) (img.rows() * scale);
                    Mat resized = new Mat();
                    opencv_imgproc.resize(img, resized, new Size(MAX_WIDTH, newH),
                            0, 0, opencv_imgproc.INTER_LANCZOS4);
                    img.close();
                    img = resized;
                }

                images.put(i, img);
            }

            System.out.println("[OpenCV] 读取 " + imageFiles.size() + " 张图片，开始拼接...");

            // 2. 拼接
            Stitcher stitcher = opencv_stitching.createStitcher(false);
            Mat panorama = new Mat();
            int status = stitcher.stitch(images, panorama);

            // 释放原始图片内存
            releaseAll(images, imageFiles.size());

            if (status != Stitcher.OK) {
                String msg = switch (status) {
                    case Stitcher.ERR_NEED_MORE_IMGS -> "图片数量不足，请提供更多有重叠的照片";
                    case Stitcher.ERR_HOMOGRAPHY_EST_FAIL -> "特征匹配失败，请确保照片之间有足够重叠区域（建议 30%-50%）";
                    case Stitcher.ERR_CAMERA_PARAMS_ADJUST_FAIL -> "投影变换计算失败，请尝试不同角度拍摄的照片";
                    default -> "拼接失败 (错误码: " + status + ")";
                };
                panorama.close();
                throw new StitchException(msg);
            }

            System.out.println("[OpenCV] 拼接完成，原始尺寸: " + panorama.cols() + "x" + panorama.rows());

            // 3. 去黑边裁剪
            Mat gray = new Mat();
            opencv_imgproc.cvtColor(panorama, gray, opencv_imgproc.COLOR_BGR2GRAY);
            Mat thresh = new Mat();
            opencv_imgproc.threshold(gray, thresh, 1, 255, opencv_imgproc.THRESH_BINARY);
            Mat coords = new Mat();
            opencv_core.findNonZero(thresh, coords);
            Rect rect = opencv_imgproc.boundingRect(coords);
            gray.close();
            thresh.close();
            coords.close();

            Mat crop = panorama.apply(rect);
            panorama.close();

            System.out.println("[OpenCV] 裁剪后尺寸: " + crop.cols() + "x" + crop.rows());

            // 4. 缩放到目标尺寸
            Mat result = resizeToTarget(crop);
            crop.close();

            // 5. 保存到 uploads 目录
            String filename = "panorama-" + UUID.randomUUID().toString().replace("-", "") + ".jpg";
            Path outputPath = uploadsDir.resolve(filename);
            opencv_imgcodecs.imwrite(outputPath.toAbsolutePath().toString(), result,
                    new int[]{opencv_imgcodecs.IMWRITE_JPEG_QUALITY, 95});
            result.close();

            String url = "/uploads/" + filename;
            System.out.println("[OpenCV] 保存成功: " + url + " (" + result.cols() + "x" + result.rows() + ")");

            return new StitchResult(url, result.cols(), result.rows());

        } catch (StitchException e) {
            throw e;
        } catch (Exception e) {
            releaseAll(images, imageFiles.size());
            throw new StitchException("拼接过程异常: " + e.getMessage(), e);
        }
    }

    /** 缩放到目标尺寸范围 */
    private Mat resizeToTarget(Mat src) {
        int w = src.cols();
        int h = src.rows();

        if (w <= 0 || h <= 0) return src.clone();

        // 按宽度缩放到 TARGET_WIDTH，保持比例
        double scaleW = (double) TARGET_WIDTH / w;
        int newW = TARGET_WIDTH;
        int newH = (int) (h * scaleW);

        Mat resized = new Mat();
        opencv_imgproc.resize(src, resized, new Size(newW, newH), 0, 0, opencv_imgproc.INTER_LANCZOS4);

        // 如果高度超过 TARGET_HEIGHT，再按高度缩一次
        if (newH > TARGET_HEIGHT) {
            double scaleH = (double) TARGET_HEIGHT / newH;
            int finalW = (int) (newW * scaleH);
            Mat finalMat = new Mat();
            opencv_imgproc.resize(resized, finalMat, new Size(finalW, TARGET_HEIGHT),
                    0, 0, opencv_imgproc.INTER_LANCZOS4);
            resized.close();
            return finalMat;
        }

        return resized;
    }

    /** 释放 MatVector 中的 Mat 内存 */
    private void releaseAll(MatVector vec, int count) {
        for (int i = 0; i < count; i++) {
            Mat m = vec.get(i);
            if (m != null && !m.isNull()) {
                m.close();
            }
        }
    }

    // ==================== 结果类 ====================

    public static class StitchResult {
        private final String url;
        private final int width;
        private final int height;

        public StitchResult(String url, int width, int height) {
            this.url = url;
            this.width = width;
            this.height = height;
        }

        public String getUrl() { return url; }
        public int getWidth() { return width; }
        public int getHeight() { return height; }
    }

    public static class StitchException extends Exception {
        public StitchException(String message) {
            super(message);
        }

        public StitchException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
