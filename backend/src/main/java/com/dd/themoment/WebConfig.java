package com.dd.themoment;

import java.io.File;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // user.dir varies by launch method (IDE/backend/ vs mvn spring-boot:run/ project root).
        // Try multiple possible paths, resolve with Paths for cross-platform safety.
        String userDir = System.getProperty("user.dir");
        java.nio.file.Path uploadsPath = null;
        java.nio.file.Path[] candidates = {
            Path.of(userDir, "backend", "uploads"),
            Path.of(userDir, "uploads"),
        };
        for (java.nio.file.Path candidate : candidates) {
            if (candidate.toFile().exists() && candidate.toFile().isDirectory()) {
                uploadsPath = candidate;
                break;
            }
        }
        if (uploadsPath == null) {
            uploadsPath = Path.of(userDir, "backend", "uploads");
            java.nio.file.Files.createDirectories(uploadsPath);
        }

        // Use toUri().toASCIIString() to get a proper file:/// URL (handles Windows backslashes)
        String resourceLocation = "file:" + uploadsPath.toUri().toASCIIString();
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(resourceLocation);
        System.out.println("[WebConfig] Serving /uploads/** from: " + resourceLocation);
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
