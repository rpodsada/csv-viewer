// Imports
const { ipcRenderer } = require('electron');
const hljs = require('highlight.js');
const html = require('html');
require("@fortawesome/fontawesome-free/js/all");

// State
let records = [];
let currentIndex = 0;
let recordsPerPage = 10;
let lastSearchTerm = '';
let lastSearchMode = null;
let lastSearchColumn = null;
let collapsedState = {};
let searchState = {
    term: null,
    column: null,
};

// Modal
let modal = document.getElementById('input-modal');
let modalInput = document.getElementById('modal-input');
let modalHeading = document.getElementById('modal-header');
let modalInstructions = document.getElementById('modal-instructions');
let modalOpen = false;

// Open file dialog to choose a CSV file on startup
ipcRenderer.send('open-csv');

/**
 * Listen for changes to the file data and update the display.
 */
ipcRenderer.on('file-data', (event, data) => {
    console.log(`File data changed, loading ${data.length} records...`);
    showAlert(`${highlight(data.length)} records loaded.`);
    currentIndex = 0;
    setRecords(data);
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
    if (event.key === 'Escape' && isSearchActive()) {
        console.log(`Cancelling search.`);
        forgetSearch();
        clearSearchState();
        displayRecord(currentIndex);
        showAlert(`Search cancelled.`);
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
        doCommand('find-again');
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
        const navAction = event.target.closest('button').getAttribute('data-nav-action');
        if (!navAction) {
            return;
        }
        switch (navAction) {
            case "first":
                console.log("First record clicked");
                firstPage();
                break;
            case "prev-page":
                console.log("Previous page clicked");
                previousPage();
                break;
            case "prev":
                console.log("Previous record clicked");
                previousRecord();
                break;
            case "next":
                console.log("Next record clicked");
                nextRecord();
                break;
            case "next-page":
                console.log("Next page clicked");
                nextPage();
                break;
            case "last":
                console.log("Last record clicked");
                lastPage();
                break;
            case "jump":
                console.log("Jump clicked");
                doCommand('jump');
                break;
            case "find":
                console.log("Find clicked");
                doCommand('find');
                break;
            case "find-again":
                console.log("Find again clicked");
                doCommand('find-again');
                break;
        }
    });
});

/**
 * Hit Go button on modal
 */
document.getElementById('modal-ok-btn').addEventListener('click', () => {
    handleModalInput();
});

/**
 * Hit enter on modal input field.
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
    const record = getRecord(index);
    const htmlTagRegex = /<([a-z][a-z0-9]*)\b[^>]*>/i;
    if (record) {
        updateButtonState();

        const container = document.getElementById('record-container');
        container.innerHTML = `<div id="record-number">${index + 1}</div>`;

        let innerTable = `<table id="record-display">`;
        for (const key in record) {
            let cellContent = record[key];
            if (typeof cellContent === 'string' && htmlTagRegex.test(cellContent)) {
                const isCollapsed = collapsedState[key] === true;
                innerTable += `
                    <tr>
                        <th class="csv-column" title="Click to search this field" data-column-name="${key}">${key}</th>
                        <td>
                            <div class="collapsible-cell ${isCollapsed ? 'collapsed' : ''}">
                                <button class="collapse-expand-btn">${isCollapsed ? arrowDown : arrowUp}</button>
                                <div class="collapsible-content" ${isCollapsed ? ' style="height: 1.2em; overflow: hidden;"' : ''}>
                                    <pre><code>${highlightSearchTerm(key, prettyHTML(cellContent), getSearchTerm(), getSearchColumn())}</code></pre>
                                </div>
                            </div>
                        </td>
                    </tr>`;
            } else {
                innerTable += `
                    <tr>
                        <th class="csv-column" title="Click to search this field" data-column-name="${key}">${key}</th>
                        <td>${highlightSearchTerm(key, cellContent, getSearchTerm(), getSearchColumn())}</td>
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
                doCommand('find-column', {
                    column: csvColumn,
                });
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
function doCommand(command, args) {
    switch (command) {
        case "find":
            modalInput.type = 'text';
            modalHeading.textContent = `Find Records with Text`;
            modalInstructions.textContent = `Displays the first record which contains the text in any field.`;
            break;
        case "find-column":
            if (!args || !args.column) {
                console.log("Column not specified for find-column command. Aborting search.");
                return;
            }
            modal.setAttribute('data-column', args.column);
            modalInput.type = 'text';
            modalHeading.innerHTML = `Search ${highlight(args.column)} for Text`;
            modalInstructions.innerHTML = `Displays the first record containing the text in the column.`;
            break;
        case "find-again":
            repeatSearch();
            return;
        case "jump":
            modalInput.type = 'number';
            modalHeading.innerHTML = `Jump to Record`;
            modalInstructions.innerHTML = `Enter a record number to jump to between ${highlight('1')} and ${highlight(records.length - 1)}.`;
            break;
        default:
            return;
    }
    modal.setAttribute('data-command', command);
    showModal();
}

/**
 * Search the data for some text.
 */
function searchData(searchText, searchColumn, startRecord) {
    const matchingIndex = findRecordIndex(searchText, searchColumn, startRecord);
    if (matchingIndex !== -1) {
        currentIndex = matchingIndex;
        setSearchState({
            term: searchText,
            column: searchColumn
        });
        displayRecord(currentIndex);
        return true;
    }
    displayRecord(currentIndex);
    return false;
}

/**
 * Get the index of a record which contains searchText in any of the fields.
 */
function findRecordIndex(searchText, searchColumn, startRecord) {
    let firstRecord = 0;
    if (startRecord) {
        const maxRecords = getMaxRecords();
        console.log(`Starting search at ${startRecord} (currently at ${currentIndex} of ${maxRecords} records)`);
        if (startRecord >= maxRecords) {
            startRecord = 0;
        }
        firstRecord = startRecord;
    }
    for (let i = firstRecord; i < records.length; i++) {
        const record = getRecord(i);
        if (searchColumn) {
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
    if (modalCommand === 'find') {
        console.log(`Process find command for ${inputValue} in any column`);
        hideModal();
        rememberSearch('find', inputValue, null);
        if (!searchData(inputValue)) {
            forgetSearch();
            showAlert(`${highlight(inputValue)} not found in document`);
            return;
        }
    }
    if (modalCommand === 'find-column') {
        const csvColumn = modal.getAttribute('data-column');
        hideModal();
        console.log(`Process find-column command for ${inputValue} in ${csvColumn}`);
        if (!csvColumn) {
            return;
        }
        rememberSearch('find-column', inputValue, csvColumn);
        if (!searchData(inputValue, csvColumn)) {
            forgetSearch();
            clearSearchState();
            showAlert(`No records found with ${highlight(inputValue)} in ${highlight(csvColumn)}`);
            return;
        }
    }
    hideModal();
}

/**
 * Show the modal.
 */
function showModal() {
    console.log(`Opening modal with command ${modal.getAttribute('data-command')}`);
    modal.style.display = 'block';
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            hideModal();
        }
    });
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
 * Show an alert message.
 */
function showAlert(message) {
    const alertContainer = document.getElementById('alert-container');
    alertContainer.innerHTML = message;
    alertContainer.classList.remove('hide');
    alertContainer.classList.add('show');
    alertContainer.addEventListener('click', (event) => { 
        event.target.classList.add('hide');
        event.target.classList.remove('show');
    });
    setTimeout(() => {
        alertContainer.classList.remove('show');
    }, 2000);
}

/**
 * Get the current search state.
 */
function getSearchState() {
    return searchState;
}

/**
 * Set the current search state.
 */
function setSearchState(newSearchState) {
    searchState = newSearchState;
}

/**
 * Set the a search state prop.
 */
function setSearchStateProp(prop, value) {
    searchStatep[prop] = value;
}

/**
 * Set the current search term.
 */
function setSearchTerm(value) {
    setSearchStateProp('term', value);
}

/**
 * Set the current search column.
 */
function setSearchColumn(value) {
    setSearchStateProp('column', value);
}

/**
 * Set the current search state.
 */
function getSearchStateProp(prop) {
    return searchState[prop] ?? null; 
}

/**
 * Get the current search term.
 */
function getSearchTerm() {
    return getSearchStateProp('term');
}

/**
 * Get the current search column.
 */
function getSearchColumn() {
    return getSearchStateProp('column');
}

/**
 * Clear the current term being searched.
 */
function clearSearchState() {
    searchState = {
        term: null,
        column: null
    }
}

/**
 * Check if a search is happening right now.
 */
function isSearchActive() {
    return searchState.term ? true : false;
}

/**
 * Remember the last search performed.
 */
function rememberSearch(searchMode, searchText, searchColumn) {
    console.log(`rememberSearch called for mode [${searchMode}] for [${searchText}] in column [${searchColumn}]`);
    if (!searchMode || !searchText) {
        return;
    }
    lastSearchMode = searchMode;
    lastSearchTerm = searchText;
    lastSearchColumn = searchColumn ?? null;
}

/**
 * Forgets the last search.
 */
function forgetSearch() {
    console.log(`forgetSearch called.`);
    lastSearchMode = null;
    lastSearchTerm = null;
    lastSearchColumn = null;
}

/**
 * Repeat the last search performed.
 */
function repeatSearch() {
    console.log(`repeatSearch called in mode [${lastSearchMode}] for [${lastSearchTerm}] in column [${lastSearchColumn}]`);
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
                showAlert(`No result found for ${highlight(lastSearchTerm)} in file, ending search.`);
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
                showAlert(`No result found for ${highlight(lastSearchTerm)} in ${highlight(lastSearchColumn)} in file, ending search.`)
            }
        }
    }
}

/**
 * Jump to a specific record.
 */
function jumpToRecord(recordNumber) {
    if (!isNaN(recordNumber) && recordNumber > 0 && recordNumber <= records.length) {
        currentIndex = recordNumber - 1;
        displayRecord(currentIndex);
    } else {
        showAlert(`Please enter a number between ${highlight('1')} and ${highlight(getMaxRecords()+1)}.`);
    }
}

/**
 * Display the next record.
 */
function nextRecord() {
    if (currentIndex < getMaxRecords()) {
        console.log("Moving to next record.");
        currentIndex++;
        displayRecord(currentIndex);
    }
}

/**
 * Display the previous record.
 */
function previousRecord() {
    if (currentIndex > 0) {
        console.log("Moving to previous record.");
        currentIndex--;
        displayRecord(currentIndex);
    }
}

/**
 * Page up.
 */
function previousPage() {
    if (currentIndex >= recordsPerPage) {
        console.log(`Paging ${recordsPerPage} records backward`);
        currentIndex -= recordsPerPage;
    } else {
        console.log(`Back ${recordsPerPage} goes beyond start of records. Setting to first record`);
        currentIndex = 0;
    }
    displayRecord(currentIndex);
}

/**
 * Page down.
 */
function nextPage() {
    let maxRecords = getMaxRecords();
    if ((currentIndex + recordsPerPage) > maxRecords) {
        console.log(`Forward ${recordsPerPage} goes beyond end of records. Setting to last record`);
        currentIndex = maxRecords;
    } else {
        console.log(`Paging ${recordsPerPage} records forward`);
        currentIndex += recordsPerPage;
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
    currentIndex = getMaxRecords();
    displayRecord(currentIndex);
}

/**
 * Disable a button by ID.
 */
function disableButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.setAttribute('disabled', 'disabled');
    }
}

/**
 * Enable a button by ID.
 */
function enableButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.removeAttribute('disabled');
    }
}

/**
 * Set whether a button is enabled or not.
 */
function setButtonEnabled(buttonId, enabled) {
    if (enabled) {
        enableButton(buttonId);
    } else {
        disableButton(buttonId);
    }
}

/**
 * Set a number of buttons to be enabled or disabled at once.
 */
function setButtonsEnabled(buttonIds, enabled) {
    buttonIds.forEach((buttonId) => {        
        setButtonEnabled(buttonId, enabled)
    }, enabled)
}

function setNavButtonsEnabled(query, enabled) {
    const buttons = document.querySelectorAll('button.navigation-button');
    buttons.forEach((button) => {
        if (button.id) {
            setButtonEnabled(button.id, enabled);
        }
    }, enabled);
}

/**
 * Update state of buttons (enabled/disabled) based on state of app.
 */
function updateButtonState() {
    if (getMaxRecords() === 0) {
        setNavButtonsEnabled(false);
        return;
    }
    setButtonsEnabled(['btn-first', 'btn-prev-page', 'btn-prev'], currentIndex > 0);
    setButtonsEnabled(['btn-next', 'btn-next-page', 'btn-last'], currentIndex < getMaxRecords());
    setButtonsEnabled(['btn-jump', 'btn-find'], getMaxRecords() > 0);
    setButtonEnabled('btn-find-again', lastSearchMode && lastSearchTerm)
}

/**
 * Retrieve current records.
 */
function getRecords() {
    return records;
}

/**
 * Retrieve current records.
 */
function getRecord(index) {
    const records = getRecords();
    if (index >= 0 && index < records.length) {
        return records[index];
    }
    return null;
}

/**
 * Update current records.
 */
function setRecords(newRecords) {
    records = newRecords;
}

/**
 * Get the total records (0-based)
 */
function getMaxRecords() {
    let records = getRecords();
    return (records.length) ? records.length - 1 : 0;
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

function highlightSearchTerm(field, content, searchTerm, searchColumn) {
    if (!content || !searchTerm) {
        return content;
    }
    if (searchColumn && field !== searchColumn) {
        return content;
    }
    if (content.includes(searchTerm)) {
        const regex = new RegExp(searchTerm, 'gi');
        content = content.replace(regex, '<mark>$&</mark>');
    } 
    return content;
}

/**
 * Returns markup needed to highlight text.
 */
function highlight(text) {
    return `<span class="highlight">${text}</span>`;
}