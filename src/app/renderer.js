var _a, _b, _c, _d;
// Imports
var ipcRenderer = require('electron').ipcRenderer;
var hljs = require('highlight.js');
var html = require('html');
require("@fortawesome/fontawesome-free/js/all");
// State
var changedSomething = false;
var fileLoaded = false;
var records = [];
var currentIndex = 0;
var recordsPerPage = 10;
var collapsedState = {};
var searchState = {
    term: '',
    column: '',
    mode: '',
};
// Modal
var appWindow = document.getElementById('app-window');
var appContent = document.getElementById('app-content');
var defaultContent = document.getElementById('default-content-container');
var recordWindow = document.getElementById('record-container');
var modal = document.getElementById('input-modal');
var modalInput = document.getElementById('modal-input');
var modalHeading = document.getElementById('modal-header');
var modalInstructions = document.getElementById('modal-instructions');
var modalOpen = false;
// On startup, place a copy of #default-content into #record-container
showScreen('default');
/**
 * Handle file-error event, display alert
 */
ipcRenderer.on('file-error', function (event, error) {
    console.log("File error: ".concat(error));
    showAlert(error);
});
/**
 * Listen for changes to the file data and update the display.
 */
ipcRenderer.on('file-data', function (event, data) {
    console.log("File data changed, loading ".concat(data.length, " records..."));
    if (!fileLoaded) {
        showScreen('record');
        fileLoaded = true;
    }
    currentIndex = 0;
    setRecords(data);
    displayRecord(currentIndex);
    showAlert("".concat(highlight(data.length), " records loaded."));
});
// Add handler for clicks on open-file-btn
(_a = document.getElementById('open-file-btn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', function () {
    ipcRenderer.send('open-csv');
});
/**
 * Handle files dragged onto app.
 */
appWindow === null || appWindow === void 0 ? void 0 : appWindow.addEventListener('dragover', function (event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
        appWindow === null || appWindow === void 0 ? void 0 : appWindow.classList.add('dragover');
    }
});
/**
 * Handle when files are dragged off of app.
 */
appWindow === null || appWindow === void 0 ? void 0 : appWindow.addEventListener('dragleave', function (event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
        appWindow === null || appWindow === void 0 ? void 0 : appWindow.classList.remove('dragover');
    }
});
/**
 * Handle files dropped onto app.
 *
 * @param event The drag event.
 * @returns void
 */
appWindow === null || appWindow === void 0 ? void 0 : appWindow.addEventListener('drop', function (event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
        console.log("A file was dropped onto the app window.");
        var files = event.dataTransfer.files;
        console.log(files);
        if (files && files.length > 0) {
            var file = files[0];
            if (file.type !== 'text/csv') {
                showAlert("Sorry, only CSV files are supported.");
                return;
            }
            // @ts-ignore (file.path does exist)
            ipcRenderer.send('file-dropped', file.path);
        }
    }
    appWindow === null || appWindow === void 0 ? void 0 : appWindow.classList.remove('dragover');
});
/**
 * Handle keyboard shortcuts.
 *
 * @param event The keyboard event.
 * @returns void
 */
document.addEventListener('keydown', function (event) {
    if (modalOpen) {
        if (event.key === 'Escape') {
            console.log("Closing dialog on ESC");
            event.preventDefault();
            hideModal();
        }
        return;
    }
    if (event.key === 'Escape' && isSearchActive()) {
        console.log("Cancelling search.");
        clearSearchState();
        displayRecord(currentIndex);
        showAlert("Search cancelled.");
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
 *
 * @param event The click event.
 * @returns void
 */
document.querySelectorAll('button.navigation-button').forEach(function (element) {
    element.addEventListener('click', function (event) {
        var _a;
        var navAction = (_a = event.target.closest('button')) === null || _a === void 0 ? void 0 : _a.getAttribute('data-nav-action');
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
 * Go button on modal clicked.
 *
 * @param event The click event.
 * @returns void
 */
(_b = document.getElementById('modal-ok-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', function () {
    handleModalInput();
});
/**
 * Close button on modal clicked.
 *
 * @param event The click event.
 * @returns void
 */
(_c = document.getElementById('modal-close-btn')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', function () {
    hideModal();
});
/**
 * Hit enter on modal input field.
 *
 * @param event The keydown event.
 * @returns void
 */
(_d = document.getElementById('modal-input')) === null || _d === void 0 ? void 0 : _d.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        handleModalInput();
    }
});
/**
 * Display a record.
 *
 * @param index The index of the record to display.
 * @returns void
 */
function displayRecord(index) {
    var _a;
    // Get the chosen record.
    var record = getRecord(index);
    if (!record) {
        return;
    }
    var arrowUp = "Collapse <i class=\"fa fa-caret-up\"></i>";
    var arrowDown = "Expand <i class=\"fa fa-caret-down\"></i>";
    var htmlTagRegex = /<([a-z][a-z0-9]*)\b[^>]*>/i;
    updateButtonState();
    if (!recordWindow) {
        return;
    }
    // Display current row number.
    recordWindow.innerHTML = "<div id=\"record-number\">".concat(index + 1, " of ").concat(getMaxRecords() + 1, "</div>");
    // Display the CSV data.
    var innerTable = "<table id=\"record-display\">";
    for (var key in record) {
        var cellContent = record[key];
        if (typeof cellContent === 'string' && htmlTagRegex.test(cellContent)) {
            var isCollapsed = collapsedState[key] === true;
            innerTable += "\n                <tr>\n                    <th class=\"csv-column\" title=\"Click to search this field\" data-column-name=\"".concat(key, "\">").concat(key, "</th>\n                    <td class=\"data-column html-column\" data-column-name=\"").concat(key, "\">\n                        <div class=\"collapsible-cell ").concat(isCollapsed ? 'collapsed' : '', "\">\n                            <button class=\"collapse-expand-btn\">").concat(isCollapsed ? arrowDown : arrowUp, "</button>\n                            <div class=\"collapsible-content\" ").concat(isCollapsed ? ' style="height: 1.2em; overflow: hidden;"' : '', ">\n                                <pre><code>").concat(highlightSearchTerm(key, prettyHTML(cellContent), getSearchTerm(), getSearchColumn()), "</code></pre>\n                            </div>\n                        </div>\n                    </td>\n                </tr>");
        }
        else {
            innerTable += "\n                <tr>\n                    <th class=\"csv-column\" title=\"Click to search this field\" data-column-name=\"".concat(key, "\">").concat(key, "</th>\n                    <td class=\"data-column\" data-column-name=\"").concat(key, "\">\n                        ").concat(highlightSearchTerm(key, cellContent, getSearchTerm(), getSearchColumn()), "\n                    </td>\n                </tr>");
        }
    }
    innerTable += "</table>";
    recordWindow.innerHTML += innerTable;
    // Activate click on CSV header columns.
    var csvColumns = document.querySelectorAll('th.csv-column');
    csvColumns.forEach(function (element) {
        element.addEventListener('click', function (event) {
            event.preventDefault();
            var column = event.target;
            var csvColumn = column.getAttribute('data-column-name');
            if (!csvColumn) {
                return;
            }
            event.preventDefault();
            doCommand('find-column', {
                column: csvColumn,
            });
        });
    });
    // Add event listener to the parent table element and delegate
    // the events to the appropriate handlers.
    (_a = document.querySelector('#record-display')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', function (event) {
        var _a, _b;
        event.preventDefault();
        var targetElement = event.target;
        // Check if the click was on a collapse/expand button
        var button = targetElement.closest('.collapse-expand-btn');
        if (button) {
            var row = button.closest('tr');
            var _c = [
                (_a = row === null || row === void 0 ? void 0 : row.querySelector('th')) === null || _a === void 0 ? void 0 : _a.getAttribute('data-column-name'),
                row === null || row === void 0 ? void 0 : row.querySelector('.collapsible-content'),
                button.parentElement
            ], key = _c[0], collapsibleContent = _c[1], collapsibleCell = _c[2];
            if (!row || !key || !collapsibleContent || !collapsibleCell) {
                return;
            }
            var isCollapsed = collapsibleCell.classList.contains('collapsed');
            collapsibleCell.classList.toggle('collapsed');
            button.innerHTML = isCollapsed ? arrowUp : arrowDown;
            collapsibleContent.style.height = isCollapsed ? 'auto' : '1.2em';
            collapsibleContent.style.overflow = isCollapsed ? 'visible' : 'hidden';
            collapsedState[key] = !isCollapsed;
        }
        else if (targetElement.closest('td.data-column')) {
            // Only copy if no text is selected. Otherwise, the user may be trying to copy text.
            if ((_b = window.getSelection()) === null || _b === void 0 ? void 0 : _b.toString()) {
                return;
            }
            // Get the name of the field from the data-column-name attribute
            var cell = targetElement.closest('td');
            var fieldName = cell === null || cell === void 0 ? void 0 : cell.getAttribute('data-column-name');
            if (!fieldName) {
                return;
            }
            var cellContent = record[fieldName];
            if (!cellContent) {
                return;
            }
            require('electron').clipboard.writeText(cellContent);
            // Display an alert that the content is copied
            var alert_1 = document.createElement('span');
            alert_1.classList.add('copied-alert');
            alert_1.innerHTML = "<i class=\"fas fa-check\"></i> Copied";
            cell === null || cell === void 0 ? void 0 : cell.appendChild(alert_1);
            setTimeout(function () {
                alert_1.remove();
            }, 500);
        }
    });
}
/**
 * Execute a command
 *
 * @param command The command to execute.
 * @param args Any arguments to pass to the command.
 * @returns void
 */
function doCommand(command, args) {
    if (args === void 0) { args = {}; }
    if (!modal || !modalInput || !modalHeading || !modalInstructions) {
        return;
    }
    switch (command) {
        case "find":
            modalInput.setAttribute('type', 'text');
            modalHeading.textContent = "Find Records with Text";
            modalInstructions.textContent = "Displays the first record which contains the text in any field.";
            break;
        case "find-column":
            if (!args || !args.column) {
                console.log("Column not specified for find-column command. Aborting search.");
                return;
            }
            modal.setAttribute('data-column', args.column);
            modalInput.setAttribute('type', 'text');
            modalHeading.innerHTML = "Search ".concat(highlight(args.column), " for Text");
            modalInstructions.innerHTML = "Displays the first record containing the text in the column.";
            break;
        case "find-again":
            repeatSearch();
            return;
        case "jump":
            modalInput.setAttribute('type', 'number');
            modalHeading.innerHTML = "Jump to Record";
            modalInstructions.innerHTML = "Enter a record number to jump to between ".concat(highlight('1'), " and ").concat(highlight(getMaxRecords().toString()), ".");
            break;
        default:
            return;
    }
    modal.setAttribute('data-command', command);
    showModal();
}
/**
 * Search the data for some text.
 *
 * @param searchText The text to search for.
 * @param searchColumn The column to search in (optional).
 * @param startRecord The record to start searching from (optional).
 * @returns void
 */
function searchData(searchText, searchColumn, startRecord) {
    if (searchColumn === void 0) { searchColumn = ''; }
    if (startRecord === void 0) { startRecord = 0; }
    var matchingIndex = findRecordIndex(searchText, searchColumn, startRecord);
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
 *
 * @param searchText The text to search for.
 * @param searchColumn The column to search in (optional).
 * @param startRecord The record to start searching from (optional).
 */
function findRecordIndex(searchText, searchColumn, startRecord) {
    var firstRecord = 0;
    if (startRecord) {
        var maxRecords = getMaxRecords();
        console.log("Starting search at ".concat(startRecord, " (currently at ").concat(currentIndex, " of ").concat(maxRecords, " records)"));
        if (startRecord >= maxRecords) {
            startRecord = 0;
        }
        firstRecord = startRecord;
    }
    for (var i = firstRecord; i < records.length; i++) {
        var record = getRecord(i);
        if (searchColumn) {
            if (record[searchColumn].toString().toLowerCase().includes(searchText.toLowerCase())) {
                return i;
            }
            continue;
        }
        // Search all fields.
        for (var field in record) {
            if (record[field].toString().toLowerCase().includes(searchText.toLowerCase())) {
                return i;
            }
        }
    }
    return -1;
}
/**
 * Handle the modal input.
 *
 * @returns void
 */
function handleModalInput() {
    if (!modal || !modalInput) {
        return;
    }
    // Get the value from the modal.
    var inputValue = modalInput === null || modalInput === void 0 ? void 0 : modalInput.value;
    if (!inputValue) {
        console.log("No value entered");
        hideModal();
        return;
    }
    // Process the input for the given command.
    var modalCommand = modal.getAttribute('data-command');
    if (modalCommand === 'jump') {
        console.log("Process jump command for record ".concat(inputValue));
        var recordNumber = parseInt(inputValue, 10);
        hideModal();
        jumpToRecord(recordNumber);
    }
    if (modalCommand === 'find') {
        console.log("Process find command for ".concat(inputValue, " in any column"));
        hideModal();
        if (!searchData(inputValue)) {
            showAlert("".concat(highlight(inputValue), " not found in document"));
            return;
        }
    }
    if (modalCommand === 'find-column') {
        var csvColumn = modal.getAttribute('data-column');
        hideModal();
        console.log("Process find-column command for ".concat(inputValue, " in ").concat(csvColumn));
        if (!csvColumn) {
            return;
        }
        if (!searchData(inputValue, csvColumn)) {
            showAlert("No records found with ".concat(highlight(inputValue), " in ").concat(highlight(csvColumn)));
            return;
        }
    }
    hideModal();
}
/**
 * Show the modal.
 *
 * @returns void
 */
function showModal() {
    console.log("Opening modal with command ".concat(modal.getAttribute('data-command')));
    modal.style.display = 'block';
    modal.addEventListener('click', function (event) {
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
 *
 * @returns void
 */
function hideModal() {
    modal.style.display = 'none';
    modal.removeAttribute('data-command');
    modal.removeAttribute('data-column');
    modalOpen = false;
}
/**
 * Show an alert message.
 *
 * @param message The message to show.
 * @returns void
 */
function showAlert(message) {
    var alertContainer = document.getElementById('alert-container');
    if (!alertContainer) {
        return;
    }
    alertContainer.innerHTML = message;
    alertContainer.classList.remove('hide');
    alertContainer.classList.add('show');
    alertContainer.addEventListener('click', function (event) {
        var alertBox = event.target;
        alertBox === null || alertBox === void 0 ? void 0 : alertBox.classList.add('hide');
        alertBox === null || alertBox === void 0 ? void 0 : alertBox.classList.remove('show');
    });
    setTimeout(function () {
        alertContainer.classList.remove('show');
    }, 2000);
}
/**
 * Get the current search state.
 *
 * @returns The current search state.
 * @returns void
 */
function getSearchState() {
    return searchState;
}
/**
 * Set the current search state.
 *
 * @param newSearchState The new search state.
 * @returns void
 */
function setSearchState(newSearchState) {
    searchState = newSearchState;
}
/**
 * Set the a search state prop.
 *
 * @param prop The prop to set.
 * @param value The value to set.
 * @returns void
 */
function setSearchStateProp(prop, value) {
    searchState[prop] = value;
}
/**
 * Set the current search term.
 *
 * @param value The value to set.
 * @returns void
 */
function setSearchTerm(value) {
    setSearchStateProp('term', value);
}
/**
 * Set the current search column.
 *
 * @param value The value to set.
 * @returns void
 */
function setSearchColumn(value) {
    setSearchStateProp('column', value);
}
/**
 * Set the current search state.
 *
 * @param value The value to set.
 * @returns void
 */
function getSearchStateProp(prop) {
    var _a;
    return (_a = searchState[prop]) !== null && _a !== void 0 ? _a : null;
}
/**
 * Get the current search term.
 *
 * @returns The current search term.
 */
function getSearchTerm() {
    return getSearchStateProp('term');
}
/**
 * Get the current search column.
 *
 * @returns The current search column.
 */
function getSearchColumn() {
    return getSearchStateProp('column');
}
/**
 * Clear the current term being searched.
 *
 * @returns void
 */
function clearSearchState() {
    searchState = {
        term: '',
        column: '',
        mode: '',
    };
}
/**
 * Check if a search is happening right now.
 *
 * @returns Whether a search is active.
 */
function isSearchActive() {
    return (searchState.mode && searchState.term) ? true : false;
}
/**
 * Repeat the last search performed.
 *
 * @returns void
 */
function repeatSearch() {
    var _a = getSearchState(), term = _a.term, column = _a.column, mode = _a.mode;
    console.log("Repeating [".concat(mode, "] search for text [").concat(term, "] in column [").concat(column, "]"));
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
            showAlert("No result found for ".concat(highlight(term), " in file, ending search."));
            break;
        case 'find':
            showAlert("No result found for ".concat(highlight(term), " in ").concat(highlight(column), " in file, ending search."));
            break;
    }
}
/**
 * Jump to a specific record.
 *
 * @param recordNumber The record number to jump to.
 * @returns void
 */
function jumpToRecord(recordNumber) {
    if (!isNaN(recordNumber) && recordNumber > 0 && recordNumber <= records.length) {
        currentIndex = recordNumber - 1;
        displayRecord(currentIndex);
    }
    else {
        showAlert("Please enter a number between ".concat(highlight('1'), " and ").concat(highlight((getMaxRecords() + 1).toString()), "."));
    }
}
/**
 * Display the next record.
 *
 * @returns void
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
 *
 * @returns void
 */
function previousPage() {
    if (currentIndex >= recordsPerPage) {
        console.log("Paging ".concat(recordsPerPage, " records backward"));
        currentIndex -= recordsPerPage;
    }
    else {
        console.log("Back ".concat(recordsPerPage, " goes beyond start of records. Setting to first record"));
        currentIndex = 0;
    }
    displayRecord(currentIndex);
}
/**
 * Page down.
 *
 * @returns void
 */
function nextPage() {
    var maxRecords = getMaxRecords();
    if ((currentIndex + recordsPerPage) > maxRecords) {
        console.log("Forward ".concat(recordsPerPage, " goes beyond end of records. Setting to last record"));
        currentIndex = maxRecords;
    }
    else {
        console.log("Paging ".concat(recordsPerPage, " records forward"));
        currentIndex += recordsPerPage;
    }
    displayRecord(currentIndex);
}
/**
 * Show first page.
 *
 * @returns void
 */
function firstPage() {
    currentIndex = 0;
    displayRecord(currentIndex);
}
/**
 * Show last page.
 *
 * @returns void
 */
function lastPage() {
    currentIndex = getMaxRecords();
    displayRecord(currentIndex);
}
/**
 * Disable a button by ID.
 *
 * @param buttonId The ID of the button to disable.
 * @returns void
 */
function disableButton(buttonId) {
    var button = document.getElementById(buttonId);
    if (button) {
        button.setAttribute('disabled', 'disabled');
    }
}
/**
 * Enable a button by ID.
 *
 * @param buttonId The ID of the button to enable.
 * @returns void
 */
function enableButton(buttonId) {
    var button = document.getElementById(buttonId);
    if (button) {
        button.removeAttribute('disabled');
    }
}
/**
 * Set whether a button is enabled or not.
 *
 * @param buttonId The ID of the button to enable/disable.
 * @param enabled Whether the button should be enabled or not.
 * @returns void
 */
function setButtonEnabled(buttonId, enabled) {
    if (enabled) {
        enableButton(buttonId);
    }
    else {
        disableButton(buttonId);
    }
}
/**
 * Set a number of buttons to be enabled or disabled at once.
 *
 * @param buttonIds The IDs of the buttons to enable/disable.
 * @param enabled Whether the buttons should be enabled or not.
 * @returns void
 */
function setButtonsEnabled(buttonIds, enabled) {
    buttonIds.forEach(function (buttonId) {
        setButtonEnabled(buttonId, enabled);
    }, enabled);
}
/**
 * Set whether the navigation buttons are enabled or not.
 *
 * @param enabled Whether the buttons should be enabled or not.
 * @returns void
 */
function setNavButtonsEnabled(enabled) {
    var buttons = document.querySelectorAll('button.navigation-button');
    buttons.forEach(function (button) {
        if (button.id) {
            setButtonEnabled(button.id, enabled);
        }
    }, enabled);
}
/**
 * Update state of buttons (enabled/disabled) based on state of app.
 *
 * @returns void
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
 * Show a particular screen for the app.
 * - default: The default screen with instructions.
 * - record: The screen with the record data.
 *
 * @param screen The screen to show.
 * @returns void
 */
function showScreen(screen) {
    if (!defaultContent || !recordWindow) {
        return;
    }
    switch (screen) {
        case 'default':
            defaultContent.style.display = 'flex';
            recordWindow.style.display = 'none';
            break;
        case 'record':
            defaultContent.style.display = 'none';
            recordWindow.style.display = 'block';
            break;
    }
}
/**
 * Retrieve current records.
 *
 * @returns The current records.
 */
function getRecords() {
    return records;
}
/**
 * Retrieve a specific record.
 *
 * @param index The index of the record to retrieve.
 * @returns The current records.
 */
function getRecord(index) {
    var records = getRecords();
    if (index >= 0 && index < records.length) {
        return records[index];
    }
    return null;
}
/**
 * Update current records.
 *
 * @param newRecords The new records.
 * @returns void
 */
function setRecords(newRecords) {
    records = newRecords;
}
/**
 * Get the total records (0-based)
 *
 * @returns The total records.
 * @returns void
 */
function getMaxRecords() {
    var records = getRecords();
    return (records.length) ? records.length - 1 : 0;
}
/**
 * Prettify and format the HTML.
 *
 * @param htmlString The HTML to format.
 * @returns The formatted HTML.
 */
function prettyHTML(htmlString) {
    return hljs.highlight(html.prettyPrint(htmlString, {
        indent_size: 3,
        max_char: 60,
    }), { language: 'html' }).value;
}
/**
 * Highlight a search term in a string.
 *
 * @param field The name of the field that's being highlighted.
 * @param content The content to search.
 * @param searchTerm The search term.
 * @param searchColumn The column being searched. If specified, the term will only be highlighted if searchColumn == field.
 * @returns The highlighted content.
 */
function highlightSearchTerm(field, content, searchTerm, searchColumn) {
    if (!content || !searchTerm) {
        return content;
    }
    if (searchColumn && field !== searchColumn) {
        return content;
    }
    var regex = new RegExp(searchTerm, 'gi');
    if (regex.test(content)) {
        content = content.replace(regex, '<mark>$&</mark>');
    }
    return content;
}
/**
 * Returns markup needed to highlight text in prompts and dialogs.
 *
 * @param text The text to highlight.
 * @returns The highlighted text.
 */
function highlight(text) {
    return "<span class=\"highlight\">".concat(text, "</span>");
}
