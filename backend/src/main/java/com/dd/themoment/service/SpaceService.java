package com.dd.themoment.service;

import com.dd.themoment.dto.AssociativeQuestionDTO;
import com.dd.themoment.entity.AssociativeQuestion;
import com.dd.themoment.entity.Space;
import com.dd.themoment.repository.SpaceRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SpaceService {

    private final SpaceRepository spaceRepository;

    public SpaceService(SpaceRepository spaceRepository) {
        this.spaceRepository = spaceRepository;
    }

    public Space createSpace(String name, String generatedImageUrl, List<AssociativeQuestionDTO> questionDTOs) {
        List<AssociativeQuestion> questions = questionDTOs == null ? List.of() : questionDTOs.stream()
                .map(dto -> {
                    AssociativeQuestion question = new AssociativeQuestion();
                    question.setId(dto.getId() == null ? UUID.randomUUID().toString() : dto.getId());
                    question.setObjectName(dto.getObjectName());
                    question.setQuestion(dto.getQuestion());
                    question.setUserAnswer(dto.getUserAnswer());
                    question.setPositionX(dto.getPositionX());
                    question.setPositionY(dto.getPositionY());
                    return question;
                })
                .collect(Collectors.toList());

        Space space = new Space(UUID.randomUUID().toString(), name, generatedImageUrl, LocalDateTime.now(), questions);
        return spaceRepository.save(space);
    }

    public List<Space> listSpaces() {
        return spaceRepository.findAll();
    }

    public Optional<Space> getSpace(String id) {
        return spaceRepository.findById(id);
    }

    public Optional<AssociativeQuestion> updateAnswer(String spaceId, String questionId, String userAnswer) {
        Optional<Space> optionalSpace = spaceRepository.findById(spaceId);
        if (optionalSpace.isEmpty()) {
            return Optional.empty();
        }
        Space space = optionalSpace.get();
        Optional<AssociativeQuestion> optionalQuestion = space.getQuestions().stream()
                .filter(question -> question.getId().equals(questionId))
                .findFirst();
        optionalQuestion.ifPresent(question -> {
            question.setUserAnswer(userAnswer);
            question.setAnsweredAt(LocalDateTime.now());
            spaceRepository.save(space);
        });
        return optionalQuestion;
    }
}
