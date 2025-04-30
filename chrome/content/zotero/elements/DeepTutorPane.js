/*
   ***** BEGIN LICENSE BLOCK *****


   Copyright © 2024 Corporation for Digital Scholarship
                Vienna, Virginia, USA
                https://www.zotero.org


   This file is part of Zotero.


   Zotero is free software: you can redistribute it and/or modify
   it under the terms of the GNU Affero General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.


   Zotero is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU Affero General Public License for more details.


   You should have received a copy of the GNU Affero General Public License
   along with Zotero.  If not, see <http://www.gnu.org/licenses/>.


   ***** END LICENSE BLOCK *****
*/

{
    class ChatbotComponent extends XULElementBase {
        content = MozXULElement.parseXULToFragment(`
           <vbox id="chatbot-container" flex="1" style="
               padding: 16px;
               background: #f8f9fa;
               border-radius: 8px;
               box-shadow: 0 2px 4px rgba(0,0,0,0.1);
               height: 100%;
               display: flex;
               flex-direction: column;
           ">
               <hbox style="margin-bottom: 16px; width: 100%; height: calc(100% - 60px);" align="center"> 
                   <scrollbox id="chat-log" flex="1" orient="vertical" style="
                       border-radius: 8px;
                       padding: 12px;
                       overflow-y: auto;
                       background: white;
                       height: 100%;
                       width: 100%;
                       box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
                   " />
               </hbox> 

               <hbox style="
                   margin-top: auto;
                   padding: 12px;
                   background: white;
                   border-radius: 8px;
                   box-shadow: 0 -1px 3px rgba(0,0,0,0.1);
               " align="center">
               		<html:div class="body" style="flex: 1; margin-right: 12px;">
					    <editable-text multiline="true" data-l10n-id="question-field" data-l10n-attrs="placeholder" style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #495057;
                            border-radius: 6px;
                            background:rgb(131, 146, 126);
                            color:rgb(26, 101, 176);
                            min-height: 40px;
                            max-height: 120px;
                            overflow-y: auto;
                        " />
				    </html:div>
                   <button id="send-btn" label="Send" style="
                       padding: 8px 16px;
                       background:rgb(44, 37, 172);
                       color: rgb(41, 33, 196);
                       border: none;
                       border-radius: 6px;
                       font-weight: 600;
                       cursor: pointer;
                       transition: background-color 0.2s;
                       box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                   " />
               </hbox>
           </vbox>
        `);

        init() {
            this._abstractField = this.querySelector('editable-text');
            this._sendButton = this.querySelector('button');
            this._sendButton.addEventListener('click', () => this._handleSend());
            this.render();
        }

        render() {
            Zotero.debug("Chatbot component loading");
            this.initialized = true;
        }

        async _handleSend() {
            const newMessage = this._abstractField.value.trim();
            if (!newMessage) return;
            this._appendMessage("User", newMessage);
            this._abstractField.value = "";
            let fileContent = await this._obtainPDFfile();

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": "Bearer YOUR_OPENAI_API_KEY",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gpt-4",
                    messages: [
                        { role: "system", content: "You are a helpful assistant." },
                        { role: "user", content: newMessage }
                    ]
                })
            });
            let AIResponse = "No Response";
            if (response.ok) {
                try {
                    AIResponse = await response.json();
                } catch(err) {
                    AIResponse = "No Response";
                }
                if (!AIResponse.error) {
                    AIResponse = AIResponse.choices?.[0]?.message?.content || "No Response";
                }
            }
            Zotero.debug(AIResponse);

            this._appendMessage("Chatbot", AIResponse);
            this._appendMessage("File Content", fileContent);
        }

        _appendMessage(sender, text) {
            const log = this.querySelector('scrollbox');
            const messageContainer = document.createXULElement("hbox");
            messageContainer.setAttribute("style", "margin: 8px 0; width: 100%;");
            
            const messageBubble = document.createXULElement("description");
            const isUser = sender === "User";
            
            // Set bubble styling
            messageBubble.setAttribute("style", `
                padding: 10px 15px;
                border-radius: 15px;
                max-width: 80%;
                word-wrap: break-word;
                background-color: ${isUser ? '#007AFF' : '#E9ECEF'};
                color: ${isUser ? 'white' : 'black'};
                margin-${isUser ? 'left' : 'right'}: auto;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            `);
            
            // Add sender name and message
            const senderLabel = document.createXULElement("description");
            senderLabel.setAttribute("style", `
                font-weight: bold;
                margin-bottom: 4px;
                display: block;
            `);
            senderLabel.textContent = sender;
            
            const messageText = document.createXULElement("description");
            messageText.setAttribute("style", "display: block;");
            messageText.textContent = text;
            
            messageBubble.appendChild(senderLabel);
            messageBubble.appendChild(messageText);
            messageContainer.appendChild(messageBubble);
            log.appendChild(messageContainer);
            log.scrollTop = log.scrollHeight;
        }

        async _obtainPDFfile() {
            const selectedItems = ZoteroPane.getSelectedItems();
            if (!selectedItems.length) {
                Zotero.debug("No items selected");
                return [];
            }

            const pdfAttachments = selectedItems.reduce((arr, item) => {
                if (item.isPDFAttachment()) {
                    return arr.concat([item]);
                }
                if (item.isRegularItem()) {
                    return arr.concat(item.getAttachments()
                        .map(x => Zotero.Items.get(x))
                        .filter(x => x.isPDFAttachment()));
                }
                return arr;
            }, []);

            if (!pdfAttachments.length) {
                Zotero.debug("No PDF attachments found in selected items");
                return [];
            }

            const fileContentList = await Promise.all(pdfAttachments.map(async (pdf) => {
                const itemID = pdf.id;
                const filePath = await pdf.getFilePathAsync();
                Zotero.debug(`PDF ItemID: ${itemID}, Path: ${filePath}`);

                try {
                    const { text, extractedPages, totalPages } = await Zotero.PDFWorker.getFullText(itemID);
                    Zotero.debug(`Extracted ${extractedPages} of ${totalPages} pages`);
                    return text ? text.substring(0, 100) : "";
                } catch (e) {
                    Zotero.debug(`Error extracting text from PDF: ${e.message}`);
                    return "";
                }
            }));

            return fileContentList;
        }
    }

    customElements.define("chatbot-component", ChatbotComponent);

    class DeepTutorPane extends XULElementBase {
        content = MozXULElement.parseXULToFragment(`
           <vbox id="main-container" flex="1" style="
               padding: 16px;
               background: #f8f9fa;
               width: 100%;
               height: 100%;
               overflow: hidden;
               display: flex;
               flex-direction: column;
           ">
               <description value="DeepTutor" style="
                   font-size: 1.2em;
                   font-weight: 600;
                   color: #2c3e50;
                   margin-bottom: 16px;
                   padding-bottom: 8px;
                   border-bottom: 2px solid #e9ecef;
               " />
               <vbox flex="1" style="width: 100%; height: 100%; overflow: hidden;">
                   <chatbot-component style="height: 100%; width: 100%;" />
               </vbox>
           </vbox>
        `);

        init() {
            this.render();
        }

        render() {
            Zotero.debug("Deep tutor loading");
            this.initialized = true;
        }
    }

    customElements.define("deep-tutor-pane", DeepTutorPane);
}
