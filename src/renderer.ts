// Imports
const { ipcRenderer } = require('electron');
const hljs = require('highlight.js');
const html = require('html');
require("@fortawesome/fontawesome-free/js/all");

// Types
interface ISearchState {
    mode: '' | 'find' | 'find-column',
    term: string,
    column: string,
}

// State
let records: { [key: string]: boolean }[] = [];
let currentIndex: number = 0;
let recordsPerPage: number = 10;
let collapsedState: { [key: string]: boolean } = {};
let searchState: ISearchState = {
    term: '',
    column: '',
    mode: '',
};

// Modal
let appWindow = document.getElementById('record-container') as HTMLElement;
let modal = document.getElementById('input-modal') as HTMLElement;
let modalInput = document.getElementById('modal-input') as HTMLInputElement;
let modalHeading = document.getElementById('modal-header') as HTMLElement;
let modalInstructions = document.getElementById('modal-instructions') as HTMLElement;
let modalOpen: boolean = false;

// Open file dialog to choose a CSV file on startup
ipcRenderer.send('open-csv');

/**
 * Listen for changes to the file data and update the display.
 */
ipcRenderer.on('file-data', (event: any, data: any) => {
    console.log(`File data changed, loading ${data.length} records...`);
    showAlert(`${highlight(data.length)} records loaded.`);
    currentIndex = 0;
    setRecords(data);
    displayRecord(currentIndex);
});

/**
 * Handle files dragged onto app.
 */
appWindow.addEventListener('dragover', (event: DragEvent) => {
    console.log("Something dragged over");
    console.log(event);
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
    }
});

/**
 * Handle files dropped onto app.
 */
appWindow?.addEventListener('drop', (event: DragEvent) => {
    console.log("Something dropped!");
    console.log(event);
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
        const files = event.dataTransfer.files;
        console.log(files);
        if (files && files.length > 0) {
            const file = files[0];
            // @ts-ignore (file.path does exist)
            ipcRenderer.send('file-dropped', file.path); 
        }
    }
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
    element.addEventListener('click', (event: Event) => {
        const navAction = (event.target as Element).closest('button')?.getAttribute('data-nav-action');
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
document.getElementById('modal-ok-btn')?.addEventListener('click', () => {
    handleModalInput();
});

/**
 * Close button on modal
 */
document.getElementById('modal-close-btn')?.addEventListener('click', () => {
    hideModal();
});

/**
 * Hit enter on modal input field.
 */
document.getElementById('modal-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        handleModalInput();
    }
});

/**
 * Display a record.
 */
function displayRecord(index: number): void {
    // Get the chosen record.
    const record = getRecord(index);
    if (!record) {
        return;
    }

    const arrowUp = `Collapse <i class="fa fa-caret-up"></i>`;
    const arrowDown = `Expand <i class="fa fa-caret-down"></i>`;
    const htmlTagRegex = /<([a-z][a-z0-9]*)\b[^>]*>/i;

    updateButtonState();

    const container = document.getElementById('record-container');
    if (!container) {
        return;
    }

    // Display current row number.
    container.innerHTML = `<div id="record-number">${index + 1}</div>`;

    // Display the CSV data.
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
            const column = event.target as Element;
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
    document.querySelector('#record-display')?.addEventListener('click', (event) => {
        const button = (event.target as Element)?.closest('.collapse-expand-btn');
        const row = button?.closest('tr');
        const [key, collapsibleContent, collapsibleCell] = [
            row?.querySelector('th')?.getAttribute('data-column-name'),
            row?.querySelector('.collapsible-content') as HTMLElement,
            button?.parentElement
        ];
        if (!button || !row || !key || !collapsibleContent || !collapsibleCell) {
            return;
        }
        
        const isCollapsed = collapsibleCell.classList.contains('collapsed');

        collapsibleCell.classList.toggle('collapsed');
        button.innerHTML = isCollapsed ? arrowUp : arrowDown;
        collapsibleContent.style.height = isCollapsed ? 'auto' : '1.2em';
        collapsibleContent.style.overflow = isCollapsed ? 'visible' : 'hidden';
        collapsedState[key] = !isCollapsed;
    });
}

/**
 * Execute a command
 */
function doCommand(command: string, args: { [key:string]: any } = {}): void {
    if (!modal || !modalInput || !modalHeading || !modalInstructions) {
        return;
    }
    switch (command) {
        case "find":
            modalInput.setAttribute('type', 'text');
            modalHeading.textContent = `Find Records with Text`;
            modalInstructions.textContent = `Displays the first record which contains the text in any field.`;
            break;
        case "find-column":
            if (!args || !args.column) {
                console.log("Column not specified for find-column command. Aborting search.");
                return;
            }
            modal.setAttribute('data-column', args.column);
            modalInput.setAttribute('type', 'text');
            modalHeading.innerHTML = `Search ${highlight(args.column)} for Text`;
            modalInstructions.innerHTML = `Displays the first record containing the text in the column.`;
            break;
        case "find-again":
            repeatSearch();
            return;
        case "jump":
            modalInput.setAttribute('type', 'number');
            modalHeading.innerHTML = `Jump to Record`;
            modalInstructions.innerHTML = `Enter a record number to jump to between ${highlight('1')} and ${highlight(getMaxRecords().toString())}.`;
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
function searchData(searchText: string, searchColumn: string = '', startRecord: number = 0) {
    const matchingIndex = findRecordIndex(searchText, searchColumn, startRecord);
    if (matchingIndex !== -1) {
        currentIndex = matchingIndex;
        setSearchState({
            term: searchText,
            column: searchColumn,
            mode: searchColumn ? 'find-column' : 'find',
        });
        displayRecord(currentIndex);
        return true;
    }
    clearSearchState();
    displayRecord(currentIndex);
    return false;
}

/**
 * Get the index of a record which contains searchText in any of the fields.
 */
function findRecordIndex(searchText: string, searchColumn: string, startRecord: number) {
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
    if (!modal || !modalInput) {
        return;
    }
    // Get the value from the modal.
    const inputValue = modalInput?.value;
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
        if (!searchData(inputValue)) {
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
        if (!searchData(inputValue, csvColumn)) {
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
function showAlert(message: string) {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) {
        return;
    }
    alertContainer.innerHTML = message;
    alertContainer.classList.remove('hide');
    alertContainer.classList.add('show');
    alertContainer.addEventListener('click', (event) => {
        const alertBox = event.target as Element;
        alertBox?.classList.add('hide');
        alertBox?.classList.remove('show');
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
function setSearchState(newSearchState: ISearchState) {
    searchState = newSearchState;
}

/**
 * Set the a search state prop.
 */
function setSearchStateProp<K extends keyof ISearchState>(prop: K, value: ISearchState[K]) {
    searchState[prop] = value;
}

/**
 * Set the current search term.
 */
function setSearchTerm(value: string) {
    setSearchStateProp('term', value);
}

/**
 * Set the current search column.
 */
function setSearchColumn(value: string) {
    setSearchStateProp('column', value);
}

/**
 * Set the current search state.
 */
function getSearchStateProp<K extends keyof ISearchState>(prop: K) {
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
        term: '',
        column: '',
        mode: '',
    }
}

/**
 * Check if a search is happening right now.
 */
function isSearchActive() {
    return (searchState.mode && searchState.term) ? true : false;
}

/**
 * Repeat the last search performed.
 */
function repeatSearch() {
    const { term, column, mode } = getSearchState();

    console.log(`Repeating [${mode}] search for text [${term}] in column [${column}]`);

    // Ensure we're searching and have correct parms.
    if (!isSearchActive()) {
        return;
    }
    if (mode === 'find-column' && !column) {
        return;
    }

    // Run the search from our current position.
    if (searchData(term, column, currentIndex + 1)) {
        return;
    }

    // Try the search again after looping around to the start again.
    if (searchData(term, column)) {
        return true;
    }

    // The value doesn't exist.
    switch (mode) {
        case 'find':
            showAlert(`No result found for ${highlight(term)} in file, ending search.`);
            break;
        case 'find':
            showAlert(`No result found for ${highlight(term)} in ${highlight(column)} in file, ending search.`)
            break;
    }
}

/**
 * Jump to a specific record.
 */
function jumpToRecord(recordNumber: number) {
    if (!isNaN(recordNumber) && recordNumber > 0 && recordNumber <= records.length) {
        currentIndex = recordNumber - 1;
        displayRecord(currentIndex);
    } else {
        showAlert(`Please enter a number between ${highlight('1')} and ${highlight((getMaxRecords()+1).toString())}.`);
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
function disableButton(buttonId: string) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.setAttribute('disabled', 'disabled');
    }
}

/**
 * Enable a button by ID.
 */
function enableButton(buttonId: string) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.removeAttribute('disabled');
    }
}

/**
 * Set whether a button is enabled or not.
 */
function setButtonEnabled(buttonId: string, enabled: boolean) {
    if (enabled) {
        enableButton(buttonId);
    } else {
        disableButton(buttonId);
    }
}

/**
 * Set a number of buttons to be enabled or disabled at once.
 */
function setButtonsEnabled(buttonIds: string[], enabled: boolean) {
    buttonIds.forEach((buttonId) => {        
        setButtonEnabled(buttonId, enabled)
    }, enabled)
}

function setNavButtonsEnabled(enabled: boolean) {
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
    setButtonEnabled('btn-find-again', isSearchActive());
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
function getRecord(index: number): any {
    const records = getRecords();
    if (index >= 0 && index < records.length) {
        return records[index];
    }
    return null;
}

/**
 * Update current records.
 */
function setRecords(newRecords: any) {
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
function prettyHTML(htmlString: string): string {
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

function highlightSearchTerm(field: string, content: string, searchTerm: string, searchColumn: string): string {
    if (!content || !searchTerm) {
        return content;
    }
    if (searchColumn && field !== searchColumn) {
        return content;
    }
    const regex = new RegExp(searchTerm, 'gi');
    if (regex.test(content)) {
        content = content.replace(regex, '<mark>$&</mark>');
    } 
    return content;
}

/**
 * Returns markup needed to highlight text.
 */
function highlight(text: string): string {
    return `<span class="highlight">${text}</span>`;
}