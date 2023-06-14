# CSV Viewer

CSV Viewer is a minimal utility built in TypeScript & Electron to quickly and easily inspect the contents
of a CSV file. It's [particulary useful](#primary-use-cases) for inspecting CSV's that contain HTML.

![Application Screenshot](https://github.com/rpodsada/csv-viewer/blob/development/screenshot/screenshot.png?raw=true)

## Starting the App

Clone the repository and:
```
cd path/to/csv-viewer/
nvm use 16
npm install && npm start
```
- The app was built with Node v16.20.0. Later versions may work too, but haven't been tested.
- Instructions on how to [compile a binary](#compiling-a-binary) are below.

## Advantages

1. Presents data in a form layout, one row per page
    - See the full contents of each cell without resizing columns
    - Fixed-width font for legibility
2. Automatically pretty-prints and colorizes HTML
    - Inspect the quality and content of HTML in the document
    - Allows collapsing HTML columns    
3. Refreshes the data automatically if the file is changed
4. Allows searching for text
    - Search all columns, or a single column only
    - Repeat your last search to quickly scroll through matches
    - Highlights your keywords in the content
6. Can be mostly [navigated using the keyboard](#keyboard-shortcuts)

## Keyboard Shortcuts 

- `Ctrl+O` or `Cmd-O` - Open file
- `J` - Jump to a specific record #   
- `F` or `Ctrl-F` or `Cmd-F` - Find text
- `F3` or `Cmd+G` - Repeat last search
- `Right Arrow` or `N` - Next Record (-1)
- `Left Arrow` or `P` - Previous Record (+1)
- `Page Up` - Jump Back 10 Records (-10)
- `Page Down` - Jump Forward 10 Records (+10)
- `Home` - First Record
- `End` - Last Record

## Primary use cases

It's useful for reviewing CSV files like:
- Output from a web scraper
- Website import/export data
- Any CSV containing HTML
- Any CSV where you want to inspect the quality of the data

Excel (and other table-format viewers) are best for reviewing the _consistency_ of the data across rows. 
This tool is best to review the _quality_ of the data in each row.

## Compiling a Binary

Windows:
```
npm run build:windows
```
Mac:
```
npm run build:mac
```
Linux:
```
npm run build:linux
```

The binary installation files will be output to the `dist/` folder as `csv-viewer-setup-x.x.x.ext`.

Outputs `exe`, `dmg`, `deb`, and `AppImage` formats for each respective platform.

## Installing a Pre-Built Binary

Pre-built binaries for the application are not yet published anywhere. On my to-do list.

## Background 

I originally developed this tool for reviewing the CSV output of a web scraper application. During the development process, I needed
to inspect the output of the CSV, particularly the HTML columns (since I was cleaning it up), countless times throughout the day.

I found myself increasingly frustrated with the tools available to view the file.
Working on a Mac, Excel is clunky and slow for this, doesn't present the data very nicely, and requires many extra clicks
to close and reload the file after an update. On a PC, the scraper can't update the file at all if it's open in Excel, 
since Excel locks the files. This meant a very frustrating process to refresh the data each time the scraper was tested.

vscode (with extensions) offers a nicer experience when it comes to refreshing the data, however, most of these present the data
in a table format, and in particular, did not make it easy to inspect the quality of the HTML data in the sheet.

Thus, I decided to create an app that allows you to clearly view and inspect the HTML content of the file and 
presents minimal barriers and hassle in loading, navigating, and refreshing the data.
