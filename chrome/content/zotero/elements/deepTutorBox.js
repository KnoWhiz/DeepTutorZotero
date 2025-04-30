/*
Experiment putting deeptutor chat box out
*/
{
    class DeepTutorBox extends XULElementBase {
        content = MozXULElement.parseXULToFragment(`
            <vbox id="chatbot-container" flex="1" style="padding: 5px; border: 1px solid red;">
                <description value="DeepTutor" style="font-weight: bold; margin-bottom: 1px;" />
            </vbox>
        `);

        init() {
            this.render();
        }

        render() {
            this.initialized = true;
        }
    }
    customElements.define("deep-tutor-box", DeepTutorBox);
}