Zotero.Message = class {
    constructor({ id, parentMessageId, userId, sessionId, subMessages, followUpQuestions, creationTime, lastUpdatedTime, status, role }) {
        this.id = id;
        this.parentMessageId = parentMessageId;
        this.userId = userId;
        this.sessionId = sessionId;
        this.subMessages = subMessages;
        this.followUpQuestions = followUpQuestions;
        this.creationTime = creationTime;
        this.lastUpdatedTime = lastUpdatedTime;
        this.status = status;
        this.role = role;
    }
}