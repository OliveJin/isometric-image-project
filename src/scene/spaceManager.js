import * as spaceApi from '../api/spaceApi.js';

export class SpaceManager {
  async previewSpace(imageUrls) {
    return spaceApi.previewSpace(imageUrls);
  }

  async createNewSpace(name, generatedImageUrl, questions) {
    return spaceApi.createSpace({ name, generatedImageUrl, questions });
  }

  async listSpaces() {
    return spaceApi.listSpaces();
  }

  async getSpace(spaceId) {
    return spaceApi.getSpace(spaceId);
  }

  async saveAnswer(spaceId, questionId, userAnswer) {
    return spaceApi.saveAnswer(spaceId, questionId, userAnswer);
  }
}
