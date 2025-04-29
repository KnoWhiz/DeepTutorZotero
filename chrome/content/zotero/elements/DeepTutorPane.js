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
    // DPZ04_4_Note: central logic for item pane

    class DeepTutorPane extends XULElementBase {
        content = MozXULElement.parseXULToFragment(`
           <vbox id="chatbot-container" flex="1" style="padding: 10px; border: 1px solid red;">
               <description value="DeepTutor" style="font-weight: bold; margin-bottom: 5px;" />
              
               <scrollbox id="chat-log" flex="1" orient="vertical" style="border: 1px solid #ccc; padding: 5px; overflow-y: auto; background: grey;" />
              
               <hbox style="margin-top: 3px;" align="center">
				    <html:div class="body">
					    <editable-text multiline="true" data-l10n-id="question-field" data-l10n-attrs="placeholder" />
				    </html:div>
               </hbox>
               <hbox style="margin-top: 5px;" align="center">
                   <button id="send-btn" label="Send" />
               </hbox>
           </vbox>
        `);

        init() {
            // Renders the values of user input, button status
            this._abstractField = this.querySelector('editable-text');
            this._sendButton = this.querySelector('button');
            // Once the user clicks the button, trigger send function
            this._sendButton.addEventListener('click', () => this._handleSend());
            // Renders the class
            // this.appendChild(this.content);


            this.render();
        }


        render() {
            // Not sure if this is necessary, but as other classes did so we tries this code
            Zotero.debug("Deep tutor loading");
            this.initialized = true;
        }

        async _handleSend() {
            // get the user input message, trim and attach user and message to append function
            const newMessage = this._abstractField.value.trim();
            if (!newMessage) return;
            this._appendMessage("User", newMessage);
            // clean the edittext field
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

            // mimic AI response
            this._appendMessage("Chatbot", AIResponse);
            this._appendMessage("File Content", fileContent);
        }

        _appendMessage(sender, text) {
            // Query scroll box and append a newly updated message into it
            const log = this.querySelector('scrollbox');
            const updateMessage = document.createXULElement("description");
            updateMessage.setAttribute("value", `${sender}: ${text}`);
            updateMessage.setAttribute("style", "margin: 2px 0;");
            // Append new message into the scroll box
            log.appendChild(updateMessage);
            // Scrolls the scroll box to the bottom
            log.scrollTop = log.scrollHeight;
        }

        async _obtainPDFfile() {
            // Get selected items from the Zotero pane
            const selectedItems = ZoteroPane.getSelectedItems();
            if (!selectedItems.length) {
                Zotero.debug("No items selected");
                return [];
            }

            // Get all PDF attachments from selected items
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

            // Process all PDF attachments in parallel and wait for all to complete
            const fileContentList = await Promise.all(pdfAttachments.map(async (pdf) => {
                const itemID = pdf.id;
                const filePath = await pdf.getFilePathAsync();
                Zotero.debug(`PDF ItemID: ${itemID}, Path: ${filePath}`);

                try {
                    const { text, extractedPages, totalPages } = await Zotero.PDFWorker.getFullText(itemID);
                    Zotero.debug(`Extracted ${extractedPages} of ${totalPages} pages`);
                    
                    // Get first 100 characters of the text, or the whole text if it's shorter
                    return text ? text.substring(0, 100) : "";
                } catch (e) {
                    Zotero.debug(`Error extracting text from PDF: ${e.message}`);
                    return "";
                }
            }));

            return fileContentList;
        }
    }


    // Registers the class to customElements
    customElements.define("deep-tutor-pane", DeepTutorPane);
}
