function update() {
	var isAsync = document.getElementById('run-as-async').checked;
	var resultLabel = document.getElementById('result-label');
	var type = isAsync ? 'async' : 'none';
	resultLabel.setAttribute('data-l10n-args', `{"type":"${type}"}`);
}

async function run() {
	var win = Zotero.getMainWindow();
	if (!win) {
		return;
	}
	var code = codeEditor.getSession().getValue();
	var isAsync = document.getElementById('run-as-async').checked;
	var result;
	var resultTextbox = document.getElementById('result');
	var spinner = document.getElementById("loading-spinner");
	spinner.setAttribute("status", "animate");
	try {
		if (isAsync) {
			code = '(async function () {' + code + '})()';
			result = await win.eval(code);
		}
		else {
			result = win.eval(code);
		}
	}
	catch (e) {
		resultTextbox.classList.add('error');
		resultTextbox.textContent = e;
		spinner.removeAttribute("status");
		return;
	}
	// Hide the spinner after a small delay so it briefly appears even
	// if the code runs fast to indicate that everything did run
	setTimeout(() => {
		spinner.removeAttribute("status");
	}, 100);
	
	resultTextbox.classList.remove('error');
	if (typeof result == 'string') {
		resultTextbox.textContent = result;
	}
	else if (result !== undefined) {
		resultTextbox.textContent = Zotero.Utilities.varDump(result);
	}
	else {
		// when nothing is returned, log undefined as the return value but
		// for clarity also add a note that the JS run was successful
		resultTextbox.textContent = `===>undefined<=== (${Zotero.getString("runJS-completed")})`;
	}
}

// eslint-disable-next-line no-unused-vars
function openHelp() {
	Zotero.launchURL("https://www.zotero.org/support/dev/client_coding/javascript_api");
}

function handleInput() { // eslint-disable-line no-unused-vars
	var checkbox = document.getElementById('run-as-async');
	var isAsync = checkbox.checked;
	if (isAsync) {
		return;
	}
	var code = codeEditor.getSession().getValue();
	// If `await` is used, switch to async mode
	if (/(^|\W)await\s/m.test(code)) {
		checkbox.checked = true;
		update();
	}
}

window.addEventListener('keypress', function (event) {
	if (Zotero.isMac) {
		if (!event.metaKey) {
			return;
		}
	}
	else if (!event.ctrlKey) {
		return;
	}
	
	if (event.shiftKey || event.altKey) {
		return;
	}
	
	if (event.key == 'r') {
		run();
		event.stopPropagation();
	}
	else if (event.key == 'w') {
		window.close();
	}
});

var shortcut = Zotero.isMac ? 'Cmd-R' : 'Ctrl+R';
document.getElementById('run-label').textContent = `(${shortcut})`;

update();

var codeEditor;
window.addEventListener("load", function (e) {
	if (e.target !== document) {
		return;
	}

	MozXULElement.insertFTLIfNeeded("zotero.ftl");
	var codeWin = document.getElementById("editor-code").contentWindow;
	codeEditor = codeWin.editor;
	var session = codeEditor.getSession();
	session.setMode(new codeWin.JavaScriptMode);
	codeEditor.setOptions({
		// TODO: Enable if we modify to autocomplete from the Zotero API
		//enableLiveAutocompletion: true,
		highlightActiveLine: false,
		showGutter: false
	});
	codeEditor.on('input', handleInput);
	codeEditor.focus();
	
	const isDarkMQL = window.matchMedia('(prefers-color-scheme: dark)');
	isDarkMQL.addEventListener("change", (ev) => {
		codeEditor.setOptions({
			theme: ev.matches ? 'ace/theme/monokai' : 'ace/theme/chrome'
		});
	});
}, false);
