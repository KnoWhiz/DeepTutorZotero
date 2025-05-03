{
    class SessionHistoryBox extends XULElementBase {
        constructor() {
            super();
            this.sessionList = [];
        }

        content = MozXULElement.parseXULToFragment(`
            <vbox id="session-history-container" flex="1" style="
                padding: 16px;
                background: #f8f9fa;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                height: 100%;
                display: flex;
                flex-direction: column;
            ">
                <!-- Search Bar Section -->
                <hbox id="search-section" style="
                    margin-bottom: 16px;
                    padding: 8px;
                    background: white;
                    border-radius: 6px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                ">
                    <html:div class="body" style="flex: 1;">
                        <editable-text multiline="false" data-l10n-id="search-field" data-l10n-attrs="placeholder" style="
                            width: 100%;
                            padding: 6px 10px;
                            border: 1px solid #495057;
                            border-radius: 6px;
                            background: #fff;
                            color: #1a65b0;
                            min-height: 32px;
                            font-size: 13px;
                        " />
                    </html:div>
                </hbox>

                <!-- Session List Section -->
                <scrollbox id="session-list" flex="1" orient="vertical" style="
                    border-radius: 8px;
                    padding: 8px;
                    overflow-y: auto;
                    background: white;
                    box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
                " />
            </vbox>
        `);

        init() {
            this._searchField = this.querySelector('editable-text');
            this._sessionList = this.querySelector('#session-list');
            this.render();
        }

        render() {
            Zotero.debug("Session History component loading");
            this.initialized = true;
        }

        updateSessionList(sessions) {
            this.sessionList = sessions;
            this._updateSessionButtons();
        }

        _updateSessionButtons() {
            // Clear existing buttons
            while (this._sessionList.firstChild) {
                this._sessionList.removeChild(this._sessionList.firstChild);
            }

            // Sort sessions by lastUpdatedTime
            const sortedSessions = [...this.sessionList].sort((a, b) => {
                const timeA = a.lastUpdatedTime || 0;
                const timeB = b.lastUpdatedTime || 0;
                return timeB - timeA;
            });

            // Create buttons for each session
            sortedSessions.forEach(session => {
                const button = document.createXULElement("button");
                button.setAttribute("label", session.sessionName || "Unnamed Session");
                button.setAttribute("style", `
                    width: 100%;
                    padding: 8px 12px;
                    margin: 4px 0;
                    background: #f8f9fa;
                    border: 1px solid #e9ecef;
                    border-radius: 6px;
                    text-align: left;
                    font-size: 13px;
                    color: #2c3e50;
                    cursor: pointer;
                    transition: background-color 0.2s;
                `);
                button.addEventListener("click", () => this.loadSession(session.sessionName));
                this._sessionList.appendChild(button);
            });
        }

        loadSession(sessionName) {
            const event = new CustomEvent('HistorySessionSelected', {
                detail: { sessionName },
                bubbles: true
            });
            this.dispatchEvent(event);
        }
    }

    customElements.define("session-history-box", SessionHistoryBox);
}