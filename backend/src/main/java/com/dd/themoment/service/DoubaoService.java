package com.dd.themoment.service;

import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class DoubaoService {

    @Value("${ark.api-key}")
    private String apiKey;
    @Value("${ark.seedream-model}")
    private String seedreamModel;

    private String escape(String text) {
        if (text == null) return "";

        return text
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", " ")
                .replace("\r", " ");
    }

    /**
     * 将可能的本地上传路径转换为 base64 data URL，
     * 以便外部 AI API（火山引擎 ARK）可以读取图片。
     * 如果是 http(s) 开头的公网 URL 则直接返回。
     */
    private String toAccessibleUrl(String url) {
        if (url == null || url.isBlank()) return url;
        // 已经是公网 URL（如 AI 生成的结果），直接返回
        if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
            return url;
        }
        // 相对路径，提取文件名
        // 格式如: /uploads/70f0776f-...jpg → 文件名: 70f0776f-...jpg
        String filename = url;
        // 去掉前导 /
        if (filename.startsWith("/")) filename = filename.substring(1);
        // 取最后一段（文件名）
        int lastSlash = filename.lastIndexOf('/');
        if (lastSlash >= 0) filename = filename.substring(lastSlash + 1);
        // 与 UploadController 保持一致：使用 user.dir + "backend/uploads/"
        String userDir = System.getProperty("user.dir");
        String[] candidates = {
            userDir + File.separator + "backend" + File.separator + "uploads" + File.separator + filename,
            userDir + File.separator + "uploads" + File.separator + filename,
        };
        byte[] data = null;
        for (String candidate : candidates) {
            Path p = Paths.get(candidate);
            if (Files.exists(p)) {
                try {
                    data = Files.readAllBytes(p);
                    System.out.println("DoubaoService: 读取图片成功 -> " + p);
                } catch (IOException e) {
                    System.err.println("DoubaoService: 读取图片失败: " + p + " -> " + e.getMessage());
                }
                break;
            }
        }
        if (data == null) {
            System.err.println("DoubaoService: 找不到本地图片文件，搜索路径: " + String.join(", ", candidates));
            return url; // 回退到原路径（会报错）
        }
        String base64 = Base64.getEncoder().encodeToString(data);
        String mimeType = "image/jpeg";
        if (filename.toLowerCase().endsWith(".png")) mimeType = "image/png";
        else if (filename.toLowerCase().endsWith(".webp")) mimeType = "image/webp";
        String dataUrl = "data:" + mimeType + ";base64," + base64;
        System.out.println("DoubaoService: 转换 data URL 长度 = " + dataUrl.length() + " 字符");
        return dataUrl;
    }

    private final OkHttpClient client = createUnsafeClient();

    private OkHttpClient createUnsafeClient() {
        try {
            TrustManager[] trustAllCerts = new TrustManager[]{
                    new X509TrustManager() {
                        @Override
                        public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                        }

                        @Override
                        public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                        }

                        @Override
                        public X509Certificate[] getAcceptedIssuers() {
                            return new X509Certificate[0];
                        }
                    }
            };

            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustAllCerts, new java.security.SecureRandom());
            SSLSocketFactory sslSocketFactory = sslContext.getSocketFactory();

            HostnameVerifier allHostsValid = new HostnameVerifier() {
                @Override
                public boolean verify(String hostname, SSLSession session) {
                    return true;
                }
            };

            return new OkHttpClient.Builder()
                    .sslSocketFactory(sslSocketFactory, (X509TrustManager) trustAllCerts[0])
                    .hostnameVerifier(allHostsValid)
                    .connectTimeout(60, TimeUnit.SECONDS)
                    .writeTimeout(60, TimeUnit.SECONDS)
                    .readTimeout(600, TimeUnit.SECONDS)
                    .build();
        } catch (Exception e) {
            throw new RuntimeException("Failed to create Unsafe OkHttpClient", e);
        }
    }

    /**
     * 图片分析
     */
    public String analyzeImages(List<String> imageUrls) throws Exception {

        StringBuilder imageContents = new StringBuilder();

        for (String url : imageUrls) {
            String accessible = toAccessibleUrl(url);
            imageContents.append("""
            ,
            {
              "type":"input_image",
              "image_url":"%s"
            }
            """.formatted(
                    escape(accessible)
            ));
        }

        String visionPrompt = """
You are a professional 360-degree VR scene reconstruction system.

The user provides FOUR photos of the SAME room from different angles.

Analyze all images together as one unified space.

Requirements:

1. Merge information from all photos.

2. Reconstruct a complete room layout.

3. Identify:
- left wall
- right wall
- front area
- back area
- ceiling
- floor

4. Resolve duplicated objects appearing in multiple photos.

5. Infer unseen areas logically.

6. Return ONLY JSON.

7. Generate a single complete prompt suitable for Seedream panoramic image generation.

8. Prompt must begin exactly with:

Generate a physically accurate equirectangular panorama suitable for immersive VR reconstruction.

The output image represents the complete surrounding environment from a single viewpoint located near the center of the room.

Every wall, piece of furniture, decoration, object, ceiling feature, and floor feature must occupy its correct angular position in 360-degree spherical space.

The image must reconstruct the real room layout rather than create an artistic reinterpretation.

Spatial continuity is critical:

- left and right image boundaries must connect seamlessly
- no duplicated furniture
- no duplicated walls
- no impossible geometry
- no floating objects
- no missing room sections

The panorama should appear as if captured by a professional 360-degree camera positioned at eye level in the center of the room.

The result must be suitable for direct use as a texture on a Three.js SphereGeometry without additional correction.

Photorealistic 360-degree equirectangular panorama, 2048x1024 resolution, VR-ready, seamless left-right edge connection, ceiling at the top of the frame, floor at the bottom, correct spatial continuity, no fisheye distortion, no perspective cropping, optimized for Three.js SphereGeometry mapping, with blur applied along the left and right edges to smooth transitions and reduce visible seams.

Return JSON only.
""";

        String json = """
{
  "model":"doubao-seed-2-0-pro-260215",
  "input":[
    {
      "role":"user",
      "content":[
        {
          "type":"input_text",
          "text":"%s"
        }
        %s
      ]
    }
  ]
}
""".formatted(
                escape(visionPrompt),
                imageContents.toString()
        );

        System.out.println("===== Vision请求JSON =====");
        System.out.println(json);

        return callVisionApi(json);
    }

    /**
     * 调用ARK接口
     */
    private String callVisionApi(String json) throws Exception {

        System.out.println("===== Vision开始请求 =====");

        RequestBody body = RequestBody.create(
                json,
                MediaType.parse("application/json")
        );

        Request request = new Request.Builder()
                .url("https://ark.cn-beijing.volces.com/api/v3/responses")
                .addHeader("Authorization", "Bearer " + apiKey)
                .addHeader("Content-Type", "application/json")
                .post(body)
                .build();

        Response response = client.newCall(request).execute();

        if (response.body() == null) {
            throw new RuntimeException("API返回为空");
        }

        String result = response.body().string();

        System.out.println("===== Vision返回 =====");
        System.out.println(result);

        if (!response.isSuccessful()) {
            throw new RuntimeException(result);
        }

        return result;
    }


    /**
     * Seedream生图
     */
    public String generateImage(
            String prompt,
            List<String> imageUrls
    ) throws Exception {

        StringBuilder images = new StringBuilder();

        for (String url : imageUrls) {
            String accessible = toAccessibleUrl(url);

            if (images.length() > 0) {
                images.append(",");
            }

            images.append("\"")
                    .append(accessible)
                    .append("\"");
        }

        String json = """
{
  "model":"doubao-seedream-5-0-260128",
  "prompt":"%s",
  "image":[
    %s
  ],
  "sequential_image_generation":"disabled",
  "response_format":"url",
  "size":"2K",
  "stream":false,
  "watermark":true
}
""".formatted(
                escape(prompt),
                images.toString()
        );

        System.out.println("===== Seedream请求 =====");
        System.out.println(json);
        System.out.println("===== Seedream Prompt =====");
        System.out.println(prompt);

        System.out.println("===== Seedream Images =====");
        imageUrls.forEach(System.out::println);

        return callImageApi(json);
    }

    private String callImageApi(String json) throws Exception {

        RequestBody body = RequestBody.create(
                json,
                MediaType.parse("application/json")
        );

        Request request = new Request.Builder()
                .url("https://ark.cn-beijing.volces.com/api/v3/images/generations")
                .addHeader("Authorization", "Bearer " + apiKey)
                .addHeader("Content-Type", "application/json")
                .post(body)
                .build();

        Response response = client.newCall(request).execute();

        if (response.body() == null) {
            throw new RuntimeException("Seedream返回为空");
        }

        String result = response.body().string();

        System.out.println("===== Seedream返回 =====");
        System.out.println(result);

        if (!response.isSuccessful()) {
            throw new RuntimeException(result);
        }

        return result;
    }

}