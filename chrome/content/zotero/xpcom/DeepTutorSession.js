Zotero.Session = class {
    constructor({ 
        id = 123, 
        userId = 1234, 
        sessionName = new Date().toISOString(), 
        creationTime = new Date().toISOString(), 
        lastUpdatedTime = new Date().toISOString(), 
        type = 'default', 
        status = 'active', 
        statusTimeline = [], 
        documentIds = [], 
        generateHash = false 
    } = {}) {
        this.id = id;
        this.userId = userId;
        this.sessionName = sessionName;
        this.creationTime = creationTime;
        this.lastUpdatedTime = lastUpdatedTime;
        this.type = type;
        this.status = status;
        this.statusTimeline = statusTimeline;
        this.documentIds = documentIds;
        this.generateHash = generateHash;
    }
}