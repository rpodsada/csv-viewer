const { ipcRenderer } = require('electron');
const hljs = require('highlight.js'); // Import the library
const html = require('html');
require("@fortawesome/fontawesome-free/js/all");

let records = [];
let currentIndex = 0;
let recordsPerPage = 10;
let lastSearchTerm = '';
let lastSearchMode = null;
let lastSearchColumn = null;
let collapsedState = {};


let modal = document.getElementById('input-modal');
let modalInput = document.getElementById('modal-input');
let modalHeading = document.getElementById('modal-header');
let modalInstructions = document.getElementById('modal-instructions');
let modalOpen = false;

/**
 * Open file dialog to choose a CSV file on startup.
 * Parse resulting CSV once chosen.
 */
ipcRenderer.invoke('open-csv').then((filePath) => {
    if (!filePath) {
        console.log("File path received from dialog was empty. Aborting file load.")
        return;
    }
    ipcRenderer.invoke('parse-csv', filePath).then((result) => {
        records = result.data;
        displayRecord(currentIndex);
    });
});

/**
 * Listen for changes to the file data and update the display.
 */
ipcRenderer.on('file-data', (event, data) => {
    records = data;
    let maxRecords = records.length - 1;
    if (currentIndex > maxRecords) {
        currentIndex = maxRecords;
    }
    displayRecord(currentIndex);
});

/**
 * Handle keyboard shortcuts.
 */
document.addEventListener('keydown', (event) => {
    if (modalOpen) {
        if (event.key === 'Escape') {
            console.log("Closing dialog on ESC");
            event.preventDefault();
            hideModal();
        }
        return;
    }
    if (event.key === 'Home') {
        console.log("First record");
        event.preventDefault();
        firstPage();
        return;
    }
    if (event.key === 'End') {
        console.log("Last record");
        event.preventDefault();
        lastPage();
        return;
    }
    if (event.key === 'PageUp') {
        console.log("Previous page");
        event.preventDefault();
        previousPage();
        return;
    }
    if (event.key === 'PageDown') {
        console.log("Next page");
        event.preventDefault();
        nextPage();
        return;
    }
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'p') {
        console.log("Previous record");
        event.preventDefault();
        previousRecord();
        return;
    }
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'n') {
        console.log("Next record");
        event.preventDefault();
        nextRecord();
        return;
    }
    if (event.key === 'F3' || (event.key.toLowerCase() === 'g' && event.metaKey)) {
        console.log("Repeating search");
        event.preventDefault();
        repeatSearch();
        return;
    }
    if (event.key.toLowerCase() === 'j') {
        console.log("Jump to record");
        event.preventDefault();
        doCommand('jump');
    }
    if (event.key.toLowerCase() === 'f') {
        console.log("Find record");
        event.preventDefault();
        doCommand('find');
    }
});

/**
 * Navigation buttons clicked.
 */
document.querySelectorAll('button.navigation-button').forEach((element) => {
    element.addEventListener('click', (event) => {
        const navAction = event.target.getAttribute('data-nav-action');
        if (!navAction) {
            return;
        }
        switch (navAction) {
            case "first":
                firstPage();
                break;
            case "prev-page":
                previousPage();
                break;
            case "prev":
                previousRecord();
                break;
            case "next":
                nextRecord();
                break;
            case "next-page":
                nextPage();
                break;
            case "last":
                lastPage();
                break;
            case "jump":
                doCommand('jump');
                break;
            case "find":
                doCommand('find');
                break;
        }
    });
});

/**
 * EVENT: Hit Go button on modal
 */
document.getElementById('modal-ok-btn').addEventListener('click', () => {
    handleModalInput();
});

/**
 * EVENT: Hit enter on modal input field.
 */
document.getElementById('modal-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        handleModalInput();
    }
});

/**
 * Display a record.
 */
function displayRecord(index) {
    const arrowUp = `Collapse <i class="fa fa-caret-up"></i>`;
    const arrowDown = `Expand <i class="fa fa-caret-down"></i>`;
    const record = records[index];
    const htmlTagRegex = /<([a-z][a-z0-9]*)\b[^>]*>/i;
    if (record) {
        const container = document.getElementById('record-container');
        container.innerHTML = `<div id="record-number">${index + 1}</div>`;

        let innerTable = `<table id="record-display">`;
        for (const key in record) {

            if (typeof record[key] === 'string' && htmlTagRegex.test(record[key])) {
                const isCollapsed = collapsedState[key] === true;
                innerTable += `
                    <tr>
                        <th class="csv-column" title="Click to search this field" data-column-name="${key}">${key}</th>
                        <td>
                            <div class="collapsible-cell ${isCollapsed ? 'collapsed' : ''}">
                                <button class="collapse-expand-btn">${isCollapsed ? arrowDown : arrowUp}</button>
                                <div class="collapsible-content" ${isCollapsed ? ' style="height: 1.2em; overflow: hidden;"' : ''}>
                                    <pre><code>${prettyHTML(record[key])}</code></pre>
                                </div>
                            </div>
                        </td>
                    </tr>`;
              } else {
                innerTable += `
                    <tr>
                        <th class="csv-column" title="Click to search this field" data-column-name="${key}">${key}</th>
                        <td>${record[key]}</td>
                    </tr>`;
              }
        }
        innerTable += `</table>`;

        container.innerHTML += innerTable;

        // Activate click on CSV columns
        const csvColumns = document.querySelectorAll('th.csv-column');
        csvColumns.forEach((element) => {
            element.addEventListener('click', (event) => {
                event.preventDefault();
                const column = event.target;
                const csvColumn = column.getAttribute('data-column-name');
                if (!csvColumn) {
                    return;
                }
                event.preventDefault();
                modalInput.type = 'text';
                modal.setAttribute('data-command', 'find-column');
                modal.setAttribute('data-column', csvColumn);
                modalHeading.innerHTML = `Search <span class="highlight">${csvColumn}</span> for Text`;
                modalInstructions.textContent = `Displays the first record which contains the text in the ${csvColumn} column of the CSV.`;
                showModal();
            });
        });

        // Add event listener to the parent table element using event delegation
        document.querySelector('#record-display').addEventListener('click', (event) => {
            const button = event.target.closest('.collapse-expand-btn');
            if (button) {
                const collapsibleCell = button.parentElement;
                const row = button.closest('tr');
                const key = row.querySelector('th').getAttribute('data-column-name');
                const collapsibleContent = row.querySelector('.collapsible-content');
                const isCollapsed = collapsibleCell.classList.contains('collapsed');

                collapsibleCell.classList.toggle('collapsed');
                if (isCollapsed) {
                    button.innerHTML = arrowUp;
                    collapsibleContent.style.height = 'auto';
                    collapsibleContent.style.overflow = 'visible';
                    collapsedState[key] = false;
                } else {
                    button.innerHTML = arrowDown;
                    collapsibleContent.style.height = '1.2em';
                    collapsibleContent.style.overflow = 'hidden';
                    collapsedState[key] = true;
                }
            }
        });

    }
}

/**
 * Execute a command
 */
function doCommand(command) {
    switch (command) {
        case "find":
            modalInput.type = 'text';
            modalHeading.textContent = `Find Records with Text`;
            modalInstructions.textContent = `Displays the first record which contains the text in any field.`;
            break;
        case "jump":
            modalInput.type = 'number';
            modalHeading.textContent = `Jump to Record`;
            modalInstructions.textContent = `Enter a record number to jump to between 1 and ${(records.length - 1)}.`;
            break;
        default:
            return;
    }
    modal.setAttribute('data-command', command);
    showModal();
}


/**
 * Handle the modal input.
 */
function handleModalInput() {
    // Get the value from the modal.
    const inputValue = document.getElementById('modal-input').value;
    if (!inputValue) {
        console.log("No value entered");
        hideModal();
        return;
    }

    // Process the input for the given command.
    const modalCommand = modal.getAttribute('data-command');
    if (modalCommand === 'jump') {
        console.log(`Process jump command for record ${inputValue}`);
        const recordNumber = parseInt(inputValue, 10);
        hideModal();
        jumpToRecord(recordNumber);
    }
    let searchResult = false;
    if (modalCommand === 'find') {
        console.log(`Process find command for ${inputValue} in any column`);
        hideModal();
        rememberSearch('find', inputValue, null);
        if (!searchData(inputValue)) {
            console.log(`No records found for ${inputValue}`)
        }
    }
    if (modalCommand === 'find-column') {
        const csvColumn = modal.getAttribute('data-column');
        console.log(`Process find-column command for ${inputValue} in ${csvColumn}`);
        hideModal();
        if (!csvColumn) {
            return;
        }
        rememberSearch('find-column', inputValue, csvColumn);
        if (!searchData(inputValue, csvColumn)) {
            forgetSearch();
            console.log(`No records found for ${inputValue} in ${csvColumn}`)
        }
    }
    hideModal();
}

/**
 * Remember the last search performed.
 */
function rememberSearch(searchMode, searchText, searchColumn) {
    if (!searchMode || !searchText) {
        return;
    }
    lastSearchMode = searchMode;
    lastSearchTerm = searchText;
    lastSearchColumn = searchColumn ?? null;
}

/**
 * Repeat the last search performed.
 */
function repeatSearch() {
    if (!lastSearchMode || !lastSearchTerm) {
        return;
    }
    let foundResult = false;
    let nextIndex = currentIndex + 1;
    if (lastSearchMode === 'find') {
        console.log(`Repeating find command for ${lastSearchTerm}`);
        foundResult = searchData(lastSearchTerm, null, nextIndex);
        if (!foundResult) {
            // Check if the value exists anywhere at all
            // If so, loop back around past 0 to the next value.
            // Otherwise, stop searching to avoid infinite loop.
            console.log(`No result found for ${lastSearchTerm} after index ${nextIndex}. Searching from start...`);
            if (!searchData(lastSearchTerm)) {
                console.log(`No result found for ${lastSearchTerm} in file, ending search.`)
            }
        }
    }
    if (lastSearchMode === 'find-column' && lastSearchColumn) {
        console.log(`Repeating find command for ${lastSearchTerm} in ${lastSearchColumn}`);
        foundResult = searchData(lastSearchTerm, lastSearchColumn, currentIndex + 1);
        if (!foundResult) {
            // Check if the value exists anywhere at all
            // If so, loop back around past 0 to the next value.
            // Otherwise, stop searching to avoid infinite loop.
            console.log(`No result found for ${lastSearchTerm} in ${lastSearchColumn} after index ${nextIndex}. Searching from start...`);
            if (!searchData(lastSearchTerm, lastSearchColumn)) {
                console.log(`No result found for ${lastSearchTerm} in ${lastSearchColumn} in file, ending search.`)
            }
        }
    }
}

/**
 * Search the data for some text.
 */
function searchData(searchText, searchColumn, startRecord) {
    const matchingIndex = findRecordIndex(searchText, searchColumn, startRecord);
    if (matchingIndex !== -1) {
        currentIndex = matchingIndex;
        displayRecord(currentIndex);
        return true;
    }
    return false;
}

/**
 * Get the index of a record which contains searchText in any of the fields.
 */
function findRecordIndex(searchText, searchColumn, startRecord) {
    let firstRecord = 0;
    if (startRecord) {
        const maxRecords = records.length - 1;
        console.log(`Starting search at ${startRecord} (currently at ${currentIndex} of ${(records.length)} records)`);
        if (startRecord >= maxRecords) {
            startRecord = 0;
        }
        firstRecord = startRecord;
    }
    for (let i = firstRecord; i < records.length; i++) {
        const record = records[i];
        // Search specific column.
        if (searchColumn) {
            //console.log(`Checking if record ${i} contains ${searchText} in ${searchColumn}: ${record[searchColumn].toString().toLowerCase()}`)
            if (record[searchColumn].toString().toLowerCase().includes(searchText.toLowerCase())) {
                return i;
            }
            continue;
        }
        // Search all fields.
        for (const field in record) {
            if (record[field].toString().toLowerCase().includes(searchText.toLowerCase())) {
                return i;
            }
        }
    }
    return -1;
}

/**
 * Show the modal.
 */
function showModal() {
    console.log(`Opening modal with command ${modal.getAttribute('data-command')}`);
    modal.style.display = 'block';
    modalInput.value = '';
    modalInput.focus();
    modalOpen = true;
}

/**
 * Hide the modal.
 */
function hideModal() {
    modal.style.display = 'none';
    modal.removeAttribute('data-command');
    modal.removeAttribute('data-column');
    modalOpen = false;
}

/**
 * Jump to a specific record.
 */
function jumpToRecord(recordNumber) {
    if (!isNaN(recordNumber) && recordNumber > 0 && recordNumber <= records.length) {
        currentIndex = recordNumber - 1;
        displayRecord(currentIndex);
    } else {
        alert("Invalid record number.");
    }
}

/**
 * Display the next record.
 */
function nextRecord() {
    if (currentIndex < records.length - 1) {
        currentIndex++;
        displayRecord(currentIndex);
    }
}

/**
 * Display the previous record.
 */
function previousRecord() {
    if (currentIndex > 0) {
        currentIndex--;
        displayRecord(currentIndex);
    }
}

/**
 * Page up.
 */
function previousPage() {
    if (currentIndex >= recordsPerPage) {
        currentIndex -= recordsPerPage;
    } else {
        currentIndex = 0;
    }
    displayRecord(currentIndex);
}

/**
 * Page down.
 */
function nextPage() {
    let maxRecords = records.length - 1;
    if (currentIndex <= maxRecords - recordsPerPage) {
        currentIndex += recordsPerPage;
    } else {
        currentIndex = maxRecords;
    }
    displayRecord(currentIndex);
}

/**
 * Show first page.
 */
function firstPage() {
    currentIndex = 0;
    displayRecord(currentIndex);
}

/**
 * Show last page.
 */
function lastPage() {
    let maxRecords = records.length - 1;
    currentIndex = maxRecords;
    displayRecord(currentIndex);
}

/**
 * Prettify and format the HTML.
 */
function prettyHTML(htmlString) {
    return hljs.highlight(
        html.prettyPrint(
            htmlString,
            {
                indent_size: 3,
                max_char: 60,
            }
        ),
        { language: 'html' }
    ).value;
}


