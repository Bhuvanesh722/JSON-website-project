// CodeMirror Editor Instances
let inputEditor = null;
let outputEditor = null;

// DOM Elements
const inputEditorContainer = document.getElementById('input-editor');
const outputEditorContainer = document.getElementById('output-editor');
const treeViewContainer = document.getElementById('tree-view-container');
const btnFormat = document.getElementById('btn-format');
const btnValidate = document.getElementById('btn-validate');
const btnMinify = document.getElementById('btn-minify');
const btnToCsv = document.getElementById('btn-to-csv');
const btnToXml = document.getElementById('btn-to-xml');
const btnToYaml = document.getElementById('btn-to-yaml');
const btnClear = document.getElementById('btn-clear');
const btnCopy = document.getElementById('btn-copy');
const btnDownload = document.getElementById('btn-download');
const btnFix = document.getElementById('btn-fix');
const btnViewCode = document.getElementById('btn-view-code');
const btnViewTree = document.getElementById('btn-view-tree');
const fileUpload = document.getElementById('file-upload');
const errorMessage = document.getElementById('error-message');
const themeToggle = document.getElementById('theme-toggle');
const iconSun = themeToggle ? themeToggle.querySelector('.theme-icon-sun') : null;
const iconMoon = themeToggle ? themeToggle.querySelector('.theme-icon-moon') : null;
const inputMeta = document.getElementById('input-meta');
// Settings Elements
const btnSettings = document.getElementById('btn-settings');
const btnLoadUrl = document.getElementById('btn-load-url');
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('close-settings');
const btnSaveSettings = document.getElementById('save-settings');
const indentSelect = document.getElementById('indent-size');
const autoFormatCheck = document.getElementById('auto-format-check');

let INDENT_SPACE = 2;
let indentMode = 'space'; // 'space' or 'tab'
let autoFormatOnPaste = false;
let isDark = true;

// Debounce utility
const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
};

// Theme Logic
const setTheme = (dark) => {
    isDark = dark;
    const theme = isDark ? 'dracula' : 'default';

    if (isDark) {
        document.body.classList.remove('light-theme');
        if (iconSun) iconSun.classList.remove('hidden');
        if (iconMoon) iconMoon.classList.add('hidden');
    } else {
        document.body.classList.add('light-theme');
        if (iconSun) iconSun.classList.add('hidden');
        if (iconMoon) iconMoon.classList.remove('hidden');
    }

    if (inputEditor) inputEditor.setOption('theme', theme);
    if (outputEditor) outputEditor.setOption('theme', theme);

    localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

const initTheme = () => {
    const saved = localStorage.getItem('theme');
    setTheme(saved ? saved === 'dark' : true);
};

// Settings Logic
const saveSettings = () => {
    const spaceVal = indentSelect.value;
    if (spaceVal === 'tab') {
        INDENT_SPACE = '\t';
        indentMode = 'tab';
    } else {
        INDENT_SPACE = parseInt(spaceVal, 10);
        indentMode = 'space';
    }

    autoFormatOnPaste = autoFormatCheck.checked;

    // Save to local storage
    localStorage.setItem('jsonease_settings', JSON.stringify({
        indent: spaceVal,
        autoFormat: autoFormatOnPaste
    }));

    // Apply changes immediately if possible
    if (outputEditor) {
        // Re-format if there is content
        formatJSON();
    }

    closeSettingsModal();
};

const loadSettings = () => {
    const saved = localStorage.getItem('jsonease_settings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);

            // Set indentation
            indentSelect.value = settings.indent;
            if (settings.indent === 'tab') {
                INDENT_SPACE = '\t';
                indentMode = 'tab';
            } else {
                INDENT_SPACE = parseInt(settings.indent, 10);
                indentMode = 'space';
            }

            // Set Auto-format
            autoFormatOnPaste = settings.autoFormat;
            autoFormatCheck.checked = autoFormatOnPaste;
        } catch (e) {
            console.error('Error loading settings', e);
        }
    }
};

const openSettingsModal = () => {
    settingsModal.classList.remove('hidden');
};

const closeSettingsModal = () => {
    settingsModal.classList.add('hidden');
};

const loadFromUrl = async () => {
    const url = prompt("Enter JSON URL:");
    if (!url) return;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const text = await response.text();

        if (inputEditor) {
            inputEditor.setValue(text);
            // Optionally auto-format if valid JSON
            try {
                JSON.parse(text);
                formatJSON();
                showError('✓ Loaded from URL');
                setTimeout(clearError, 2000);
            } catch (e) {
                // Just load text if invalid JSON
            }
        }
    } catch (e) {
        showError(`Failed to load URL: ${e.message}`);
    }
};

// Initialize CodeMirror Editors
const initEditors = () => {
    if (typeof CodeMirror === 'undefined') {
        console.error('CodeMirror not loaded');
        return;
    }

    const commonOptions = {
        mode: { name: 'javascript', json: true },
        theme: isDark ? 'dracula' : 'default',
        lineNumbers: true,
        lineWrapping: false,
        tabSize: 2,
        indentWithTabs: false,
        matchBrackets: true,
        autoCloseBrackets: true,
        foldGutter: true,
        gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
    };

    if (inputEditorContainer) {
        inputEditor = CodeMirror(inputEditorContainer, {
            ...commonOptions,
            placeholder: 'Paste your JSON here...',
        });

        inputEditor.on('change', debounce(() => {
            updateMeta();
            if (autoFormatOnPaste) {
                // Determine if this was a paste event? 
                // CodeMirror change obj has origin 'paste'
            }
        }, 150));

        inputEditor.on('change', (cm, change) => {
            if (autoFormatOnPaste && change.origin === 'paste') {
                // Defer slightly to allow value to set
                setTimeout(formatJSON, 50);
            }
        });
    }

    if (outputEditorContainer) {
        outputEditor = CodeMirror(outputEditorContainer, {
            ...commonOptions,
            readOnly: true,
            placeholder: 'Result will appear here...',
        });
    }
};

// Utility Functions
const updateMeta = () => {
    if (!inputEditor || !inputMeta) return;
    const text = inputEditor.getValue();
    const bytes = new TextEncoder().encode(text).length;
    let size = '';
    if (bytes < 1024) {
        size = `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
        size = `${(bytes / 1024).toFixed(1)} KB`;
    } else {
        size = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    inputMeta.textContent = size;
};

const showError = (msg) => {
    if (!errorMessage) return;
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
};

const clearError = () => {
    if (!errorMessage) return;
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
};

const getTimestamp = () => {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
};

// Error Parsing
const getLineColumn = (text, index) => {
    if (index >= text.length) index = text.length - 1;
    if (index < 0) return { line: 1, column: 1 };

    let line = 1;
    let column = 1;
    for (let i = 0; i < index; i++) {
        if (text[i] === '\n') {
            line++;
            column = 1;
        } else {
            column++;
        }
    }
    return { line, column };
};

const handleError = (error) => {
    const errorString = error.message || String(error);
    const text = inputEditor ? inputEditor.getValue() : '';

    // Try to extract position from V8 error message
    const posMatch = errorString.match(/at position (\d+)/i);
    if (posMatch) {
        const charIndex = parseInt(posMatch[1], 10);
        const { line, column } = getLineColumn(text, charIndex);
        showError(`Error at Line ${line}, Column ${column}: ${errorString.replace(/at position \d+/i, '').trim()}`);

        // Jump to error location in CodeMirror
        if (inputEditor) {
            inputEditor.setCursor({ line: line - 1, ch: column - 1 });
            inputEditor.focus();
        }
        return;
    }

    // Improve Error Messages
    let friendlyMsg = errorString.replace(/at position \d+/i, '').trim();

    if (friendlyMsg.includes("Unexpected token }")) {
        friendlyMsg = "It looks like you have an extra closing brace '}' or a trailing comma before it.";
    } else if (friendlyMsg.includes("Unexpected token ]")) {
        friendlyMsg = "It looks like you have an extra closing bracket ']' or a trailing comma before it.";
    } else if (friendlyMsg.includes("Unexpected token ,")) {
        friendlyMsg = "You might have a misplaced comma ',' or a missing value.";
    } else if (friendlyMsg.includes("Unexpected end of JSON input")) {
        friendlyMsg = "The JSON string ends prematurely. Check for missing closing braces '}' or brackets ']'.";
    }

    showError(`Error: ${friendlyMsg}`);
};

// Fix JSON Logic
const fixJSON = () => {
    if (!inputEditor) return;
    let text = inputEditor.getValue();
    if (!text.trim()) return;

    try {
        // Strategy 1: Smart Regex Heuristics (Common Mistakes)
        // Remove trailing commas in objects
        text = text.replace(/,(\s*[}\]])/g, '$1');
        // Replace single quotes with double quotes (simple cases)
        text = text.replace(/'([^']*)':/g, '"$1":');
        text = text.replace(/: '([^']*)'/g, ': "$1"');

        // Strategy 2: Use Tolerant Parser (JSON5) if available
        let parsed;
        if (typeof JSON5 !== 'undefined') {
            try {
                parsed = JSON5.parse(text);
            } catch (e5) {
                // If JSON5 also fails, we rely on the regex changes
                // or try to standard parse the regex-modified text
            }
        }

        // If JSON5 regex/didn't run, try standard parse
        if (!parsed) {
            parsed = JSON.parse(text);
        }

        // If we reached here, we successfully parsed it either via JSON5 or Regex helps
        const formatted = JSON.stringify(parsed, null, INDENT_SPACE);
        inputEditor.setValue(formatted); // Update input with fixed version
        outputEditor.setValue(formatted);
        clearError();
        showError('✓ Magic Fix Applied!');
        setTimeout(clearError, 2000);

    } catch (e) {
        showError(`Could not auto-fix: ${e.message}`);
    }
};

// Tree View Logic
const createTreeNode = (key, value) => {
    const node = document.createElement('div');
    node.className = 'tree-node';

    if (value === null) {
        node.innerHTML = `<span class="tree-key">"${key}"</span>: <span class="tree-value-null">null</span>`;
        return node;
    }

    if (typeof value === 'object') {
        const isArray = Array.isArray(value);
        const isEmpty = Object.keys(value).length === 0;
        const openChar = isArray ? '[' : '{';
        const closeChar = isArray ? ']' : '}';

        if (isEmpty) {
            node.innerHTML = `<span class="tree-key">"${key}"</span>: ${openChar}${closeChar}`;
            return node;
        }

        const toggler = document.createElement('span');
        toggler.className = 'tree-toggler';
        toggler.textContent = '▼';
        toggler.onclick = (e) => {
            e.stopPropagation();
            const childrenContainer = node.querySelector('.tree-children');
            if (childrenContainer) {
                const isHidden = childrenContainer.style.display === 'none';
                childrenContainer.style.display = isHidden ? 'block' : 'none';
                toggler.textContent = isHidden ? '▼' : '▶';
            }
        };

        const header = document.createElement('span');
        header.innerHTML = `<span class="tree-key">"${key}"</span>: ${openChar}`;
        header.style.cursor = 'pointer';
        header.onclick = () => toggler.click();

        const children = document.createElement('div');
        children.className = 'tree-children';
        children.style.paddingLeft = '20px'; // Indent children

        // Populate children
        Object.keys(value).forEach(k => {
            children.appendChild(createTreeNode(k, value[k]));
        });

        const footer = document.createElement('div');
        footer.textContent = closeChar;

        node.appendChild(toggler);
        node.appendChild(header);
        node.appendChild(children);
        node.appendChild(footer);
    } else {
        const type = typeof value;
        let valueStr = value;
        if (type === 'string') valueStr = `"${value}"`;

        node.innerHTML = `<span class="tree-key">"${key}"</span>: <span class="tree-value-${type}">${valueStr}</span>`;
    }

    return node;
};

const renderTreeView = (data) => {
    if (!treeViewContainer) return;
    treeViewContainer.innerHTML = '';

    // Create a root wrapper to handle the top-level object/array
    const rootKey = Array.isArray(data) ? 'root' : 'root';
    // Ideally we just want to show the content. 
    // For simplicity, let's just iterate top keys if it's an object, or show regular nodes.

    // Better approach matching jsonformatter.org: Just show the root object expandable
    // But since our recursive function takes a key, let's wrap it?
    // Or just iterate keys if it's an object?

    if (typeof data === 'object' && data !== null) {
        Object.keys(data).forEach(key => {
            treeViewContainer.appendChild(createTreeNode(key, data[key]));
        });
    } else {
        treeViewContainer.textContent = String(data);
    }
};

const updateTreeView = () => {
    if (!inputEditor) return;
    try {
        const text = inputEditor.getValue();
        const data = JSON.parse(text);
        renderTreeView(data);
    } catch (e) {
        // treeViewContainer.textContent = 'Invalid JSON';
    }
};

// View Toggle
const switchView = (view) => {
    if (view === 'code') {
        outputEditorContainer.classList.remove('hidden');
        treeViewContainer.classList.add('hidden');
        btnViewCode.classList.add('active', 'btn-primary');
        btnViewCode.classList.remove('btn-secondary');
        btnViewTree.classList.remove('active', 'btn-primary');
        btnViewTree.classList.add('btn-secondary');
    } else {
        outputEditorContainer.classList.add('hidden');
        treeViewContainer.classList.remove('hidden');
        btnViewCode.classList.remove('active', 'btn-primary');
        btnViewCode.classList.add('btn-secondary');
        btnViewTree.classList.add('active', 'btn-primary');
        btnViewTree.classList.remove('btn-secondary');
        updateTreeView();
    }
};

if (btnViewCode) btnViewCode.addEventListener('click', () => switchView('code'));
if (btnViewTree) btnViewTree.addEventListener('click', () => switchView('tree'));


// Core Functions
const formatJSON = () => {
    if (!inputEditor || !outputEditor) return;

    const text = inputEditor.getValue().trim();
    if (!text) {
        outputEditor.setValue('');
        clearError();
        return;
    }

    try {
        const parsed = JSON.parse(text);
        const formatted = JSON.stringify(parsed, null, INDENT_SPACE);
        outputEditor.setValue(formatted);
        clearError();
        if (treeViewContainer && !treeViewContainer.classList.contains('hidden')) {
            renderTreeView(parsed);
        }
    } catch (e) {
        handleError(e);
        outputEditor.setValue('');
    }
};

const validateJSON = () => {
    if (!inputEditor) return;

    const text = inputEditor.getValue().trim();
    if (!text) {
        showError('Input is empty');
        return;
    }

    try {
        JSON.parse(text);
        clearError();
        showError('✓ Valid JSON');
        errorMessage.style.background = 'var(--btn-primary-bg)';
        setTimeout(() => {
            clearError();
            errorMessage.style.background = '';
        }, 2000);
    } catch (e) {
        handleError(e);
    }
};

const minifyJSON = () => {
    if (!inputEditor || !outputEditor) return;

    const text = inputEditor.getValue().trim();
    if (!text) {
        outputEditor.setValue('');
        clearError();
        return;
    }

    try {
        const parsed = JSON.parse(text);
        const minified = JSON.stringify(parsed);
        outputEditor.setValue(minified);
        clearError();
    } catch (e) {
        handleError(e);
        outputEditor.setValue('');
    }
};

// Converters
const jsonToCsv = (obj) => {
    if (!Array.isArray(obj) || obj.length === 0 || typeof obj[0] !== 'object') {
        throw new Error('CSV conversion requires a JSON array of objects');
    }

    // Flatten objects helper
    const flatten = (data, prefix = '', res = {}) => {
        for (let key in data) {
            const val = data[key];
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (val && typeof val === 'object' && val !== null) {
                flatten(val, newKey, res);
            } else {
                res[newKey] = val;
            }
        }
        return res;
    };

    const flatData = obj.map(item => flatten(item));
    const headers = [...new Set(flatData.flatMap(Object.keys))];

    const csvRows = [headers.join(',')];

    flatData.forEach(row => {
        const values = headers.map(header => {
            const val = row[header] === undefined ? '' : row[header];
            const stringVal = String(val);
            return stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')
                ? `"${stringVal.replace(/"/g, '""')}"`
                : stringVal;
        });
        csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
};

const jsonToXml = (obj) => {
    const toXml = (data, rootName = 'root') => {
        let xml = '';
        if (Array.isArray(data)) {
            data.forEach(item => {
                xml += toXml(item, 'item');
            });
        } else if (typeof data === 'object' && data !== null) {
            xml += `<${rootName}>`;
            Object.keys(data).forEach(key => {
                xml += toXml(data[key], key);
            });
            xml += `</${rootName}>`;
        } else {
            xml += `<${rootName}>${String(data)}</${rootName}>`;
        }
        return xml;
    };

    return '<?xml version="1.0" encoding="UTF-8"?>\n' + toXml(obj);
};

const convertData = (type) => {
    if (!inputEditor || !outputEditor) return;
    const text = inputEditor.getValue().trim();
    if (!text) return;

    try {
        const data = JSON.parse(text);
        let result = '';
        let mode = 'text/plain';

        if (type === 'csv') {
            result = jsonToCsv(data);
            mode = 'text/csv';
        } else if (type === 'xml') {
            result = jsonToXml(data);
            mode = 'application/xml';
        } else if (type === 'yaml') {
            if (typeof jsyaml !== 'undefined') {
                result = jsyaml.dump(data);
                mode = 'text/x-yaml';
            } else {
                result = 'js-yaml library not loaded';
            }
        }

        outputEditor.setValue(result);
        outputEditor.setOption('mode', mode);

        // Hide tree view if active
        if (!treeViewContainer.classList.contains('hidden')) {
            switchView('code'); // Switch back to code view to show result
        }
        clearError();
    } catch (e) {
        handleError(e);
    }
};

// Event Listeners
if (btnFormat) btnFormat.addEventListener('click', formatJSON);
if (btnValidate) btnValidate.addEventListener('click', validateJSON);
if (btnMinify) btnMinify.addEventListener('click', minifyJSON);

if (btnToCsv) btnToCsv.addEventListener('click', () => convertData('csv'));
if (btnToXml) btnToXml.addEventListener('click', () => convertData('xml'));
if (btnToYaml) btnToYaml.addEventListener('click', () => convertData('yaml'));
if (btnFix) btnFix.addEventListener('click', fixJSON);

if (btnClear) btnClear.addEventListener('click', () => {
    if (inputEditor) inputEditor.setValue('');
    if (outputEditor) outputEditor.setValue('');
    clearError();
    updateMeta();
});

if (btnCopy) btnCopy.addEventListener('click', async () => {
    if (!outputEditor) return;
    const content = outputEditor.getValue();
    if (!content) return;

    try {
        await navigator.clipboard.writeText(content);
        const originalText = btnCopy.textContent;
        btnCopy.textContent = 'Copied!';
        setTimeout(() => btnCopy.textContent = originalText, 2000);
    } catch (err) {
        console.error('Failed to copy', err);
    }
});

if (btnDownload) btnDownload.addEventListener('click', () => {
    if (!outputEditor) return;
    const content = outputEditor.getValue();
    if (!content) return;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jsonease-${getTimestamp()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// File Upload
if (fileUpload) {
    fileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (inputEditor) {
                inputEditor.setValue(event.target.result);
                updateMeta();
            }
        };
        reader.onerror = () => {
            showError('Failed to read file');
        };
        reader.readAsText(file);

        // Reset input so same file can be uploaded again
        fileUpload.value = '';
    });
}

if (themeToggle) themeToggle.addEventListener('click', () => setTheme(!isDark));

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadSettings();
    initEditors();
});

// Settings & URL Events
if (btnSettings) btnSettings.addEventListener('click', openSettingsModal);
if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettingsModal);
if (btnSaveSettings) btnSaveSettings.addEventListener('click', saveSettings);
if (btnLoadUrl) btnLoadUrl.addEventListener('click', loadFromUrl);

// Close modal on outside click
window.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettingsModal();
});
