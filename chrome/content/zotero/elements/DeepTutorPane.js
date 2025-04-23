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
           <vbox id="chatbot-container" flex="1" style="padding: 10px; border: 1px solid gray;">
               <description value="Simple Chatbot" style="font-weight: bold; margin-bottom: 5px;" />
              
               <scrollbox id="chat-log" flex="1" orient="vertical" style="border: 1px solid #ccc; padding: 5px; overflow-y: auto; background: white;" />
              
               <hbox style="margin-top: 5px;" align="center">
                   <textbox id="chat-input" flex="1" placeholder="Type your message..." />
                   <button id="send-btn" label="Send" />
               </hbox>
           </vbox>
        `);




        init() {
            this._abstractField.ariaLabel = Zotero.getString('itemFields.abstractNote');
            this.appendChild(this.content);
            this.render();
        }


        render() {
            Zotero.debug("Deep tutor loading");
            this.initialized = true;
        }
    }


    customElements.define("deep-tutor-pane", DeepTutorPane);
}
