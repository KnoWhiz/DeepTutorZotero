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

        _handleSend() {
            // get the user input message, trim and attach user and message to append function
            const newMessage = this._abstractField.value.trim();
            if (!newMessage) return;
            this._appendMessage("User", newMessage);
            // clean the edittext field
            this._abstractField.value = "";

            // mimic AI response
            setTimeout(() => {
                this._appendMessage("Chatbot", "Message Received");
            }, 250);
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
    }


    // Registers the class to customElements
    customElements.define("deep-tutor-pane", DeepTutorPane);
}
