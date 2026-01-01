// DOM Elements
const schemaFields = document.getElementById('schema-fields');
const btnGenerate = document.getElementById('btn-generate');
const btnAddField = document.getElementById('btn-add-field');
const btnCopy = document.getElementById('btn-copy');
const btnDownload = document.getElementById('btn-download');
const countInput = document.getElementById('count-input');
const jsonOutput = document.getElementById('json-output');
const outputLines = document.getElementById('output-lines');
const themeToggle = document.getElementById('theme-toggle');
const iconSun = themeToggle ? themeToggle.querySelector('.theme-icon-sun') : null;
const iconMoon = themeToggle ? themeToggle.querySelector('.theme-icon-moon') : null;

let fieldIdCounter = 3; // Start after initial fields
let isDark = true;

// Sample Data
const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
const DOMAINS = ['example.com', 'test.org', 'mail.net', 'dev.io'];

// Theme Logic
const setTheme = (dark) => {
    isDark = dark;
    if (isDark) {
        document.body.classList.remove('light-theme');
        if (iconSun) iconSun.classList.remove('hidden');
        if (iconMoon) iconMoon.classList.add('hidden');
    } else {
        document.body.classList.add('light-theme');
        if (iconSun) iconSun.classList.add('hidden');
        if (iconMoon) iconMoon.classList.remove('hidden');
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

const initTheme = () => {
    const saved = localStorage.getItem('theme');
    setTheme(saved ? saved === 'dark' : true);
};

// Line Numbers
const updateLineNumbers = (textarea, gutter) => {
    if (!textarea || !gutter) return;
    const lines = textarea.value.split('\n').length;
    gutter.innerHTML = Array(lines).fill(0).map((_, i) => i + 1).join('\n');
};

const syncScroll = (textarea, gutter) => {
    if (!textarea || !gutter) return;
    gutter.scrollTop = textarea.scrollTop;
};

// Random Data Generators
const generateValue = (type) => {
    switch (type) {
        case 'number':
            return Math.floor(Math.random() * 1000);
        case 'string':
            return Math.random().toString(36).substring(2, 10);
        case 'boolean':
            return Math.random() > 0.5;
        case 'uuid':
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        case 'name':
            return FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)] + ' ' +
                LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        case 'email':
            const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)].toLowerCase();
            const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
            return `${name}${Math.floor(Math.random() * 100)}@${domain}`;
        default:
            return null;
    }
};

// Core Generation Logic
const generateJSON = () => {
    const count = parseInt(countInput.value, 10) || 1;
    const fieldElements = schemaFields.querySelectorAll('.schema-field');

    const schema = [];
    fieldElements.forEach(el => {
        const name = el.querySelector('.field-name').value.trim();
        const type = el.querySelector('.field-type').value;
        if (name) {
            schema.push({ name, type });
        }
    });

    if (schema.length === 0) {
        jsonOutput.value = '// Add at least one field to generate JSON';
        return;
    }

    const result = [];
    for (let i = 0; i < count; i++) {
        const obj = {};
        schema.forEach(field => {
            obj[field.name] = generateValue(field.type);
        });
        result.push(obj);
    }

    jsonOutput.value = JSON.stringify(result, null, 2);
    updateLineNumbers(jsonOutput, outputLines);
};

// Add Field
const addField = () => {
    const newField = document.createElement('div');
    newField.className = 'schema-field';
    newField.dataset.id = fieldIdCounter++;
    newField.innerHTML = `
        <input type="text" class="field-name" placeholder="Field name">
        <select class="field-type">
            <option value="number">Number</option>
            <option value="string" selected>String</option>
            <option value="boolean">Boolean</option>
            <option value="uuid">UUID</option>
            <option value="name">Name</option>
            <option value="email">Email</option>
        </select>
        <button class="btn-remove-field" title="Remove">&times;</button>
    `;
    schemaFields.appendChild(newField);
};

// Remove Field (Event Delegation)
schemaFields.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-remove-field')) {
        e.target.parentElement.remove();
    }
});

// Utility Functions
const getTimestamp = () => {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
};

// Event Listeners
btnGenerate.addEventListener('click', generateJSON);
btnAddField.addEventListener('click', addField);

btnCopy.addEventListener('click', async () => {
    if (!jsonOutput.value) return;
    try {
        await navigator.clipboard.writeText(jsonOutput.value);
        const originalText = btnCopy.textContent;
        btnCopy.textContent = 'Copied!';
        setTimeout(() => btnCopy.textContent = originalText, 2000);
    } catch (err) {
        console.error('Failed to copy', err);
    }
});

btnDownload.addEventListener('click', () => {
    const content = jsonOutput.value;
    if (!content) return;

    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jsonease-generated-${getTimestamp()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

if (themeToggle) themeToggle.addEventListener('click', () => setTheme(!isDark));

if (jsonOutput) {
    jsonOutput.addEventListener('scroll', () => syncScroll(jsonOutput, outputLines));
}

// Initialize
initTheme();
