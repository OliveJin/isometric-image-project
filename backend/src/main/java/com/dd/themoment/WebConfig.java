package com.dd.themoment;

import java.io.File;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // user.dir 因启动方式不同可能不同（IDE/backend/ vs mvn spring-boot:run/项目根目录）
        // 尝试多个可能的路径
        String userDir = System.getProperty("user.dir");
        String[] candidates = {
            userDir + "/backend/uploads/",
            userDir + "/uploads/",
            userDir + "/uploads"
        };
        String uploadsPath = null;
        for (String candidate : candidates) {
            File dir = new File(candidate.replace("/", java.io.File.separator));
            if (dir.exists() && dir.isDirectory()) {
                uploadsPath = candidate;
                break;
            }
        }
        if (uploadsPath == null) {
            uploadsPath = userDir + "/backend/uploads/";
        }
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + uploadsPath);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins(
                        "http://localhost:3000",
                        "http://localhost:5173",
                        "http://127.0.0.1:3000",
                        "http://127.0.0.1:5173"
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
