package com.dd.themoment.repository;

import com.dd.themoment.entity.Space;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.stereotype.Repository;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Repository
public class SpaceRepository {

    private final Path storageFile = Path.of("space-store.json");
    private final ObjectMapper objectMapper;
    private List<Space> spaces = new ArrayList<>();

    public SpaceRepository() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
    }

    @PostConstruct
    public void init() {
        loadSpaces();
    }

    private void loadSpaces() {
        try {
            if (Files.exists(storageFile)) {
                String raw = Files.readString(storageFile);
                if (raw != null && !raw.isBlank()) {
                    spaces = objectMapper.readValue(raw, new TypeReference<List<Space>>() {});
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
            spaces = new ArrayList<>();
        }
    }

    private void persistSpaces() {
        try {
            Files.writeString(storageFile, objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(spaces));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public synchronized List<Space> findAll() {
        return new ArrayList<>(spaces);
    }

    public synchronized Optional<Space> findById(String id) {
        return spaces.stream().filter(space -> space.getId().equals(id)).findFirst();
    }

    public synchronized Space save(Space space) {
        findById(space.getId()).ifPresent(existing -> spaces.remove(existing));
        spaces.add(space);
        persistSpaces();
        return space;
    }
}
