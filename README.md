# CSV Viewer

CSV Viewer is a minimal utility built in TypeScript & Electron to quickly and easily inspect the contents
of a CSV file. It's [particulary useful](#primary-use-cases) for inspecting CSV's that contain HTML.

![Application Screenshot](https://github.com/rpodsada/csv-viewer/blob/development/screenshot/screenshot.png?raw=true)

## Table of Contents

- [Starting a Development Environment](#starting-a-development-environment)
- [Compiling a Binary](#compiling-a-binary)
- [Primary Use Cases](#primary-use-cases)
- [Advantages](#advantages)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Mouse Actions](#mouse-actions)
- [Project Background](#project-background)
- [Contributing](#contributing)
- [License](#license)

## Starting a Development Environment

Clone the repository and:
```
cd path/to/csv-viewer/
nvm use 16
npm install
npm start
```
- The app was built with Node v16.20.0. Later versions may work too, but haven't been tested.
- Hot reload is setup with `nodemon` & `electron-reload`
    - If it can't find nodemon:
        ```
        npm install -g nodemon
        ```
- Instructions on how to [compile a binary](#compiling-a-binary) are below.

## Compiling a Binary

Build for Your Current Platform:
```
npm run build-windows
```
Windows `.exe`
```
npm run build-windows
```
Mac `.dmg`
```
npm run build-mac
```
Linux `.deb` `.AppImage`
```
npm run build-linux
```
The binary installation files will be output to the `dist/` folder as `csv-viewer-setup-x.x.x.ext`.

## Primary use cases

This tool is most useful for reviewing CSV files like:
- Output from a web scraper
- Website import/export data
- Any CSV containing HTML
- Any CSV where you want to inspect the quality of the data

Excel (and other table-format viewers) are best for reviewing the _consistency_ of the data across rows. 
This tool is best to review the _quality_ of the data in each row.

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

## Mouse Actions

- Click on a column header to search for text in that column
- Click on a value cell to copy the contents to your clipboard
- Use the Expand/Collapse button to toggle the visibility of HTML columns

## Project Background 

I originally developed this tool for reviewing the CSV output of a web scraper application. During the development process, I needed to inspect the output of the CSV, particularly the HTML columns (since I was cleaning it up), countless times throughout the day.

I found myself increasingly frustrated with the tools available to view the file. Working on a Mac, Excel is clunky and slow for this, doesn't present the data very nicely, and requires many extra clicks to close and reload the file after an update. On a PC, the scraper can't update the file at all if it's open in Excel, since Excel locks the files. This meant a very frustrating process to refresh the data each time the scraper was tested.

vscode (with extensions) offers a nicer experience when it comes to refreshing the data, however, most of these present the data in a table format, and in particular, did not make it easy to inspect the quality of the HTML data in the sheet.

Thus, I decided to create an app that allows you to clearly view and inspect the HTML content of the file and presents minimal barriers and hassle in loading, navigating, and refreshing the data. I found it useful during my project, maybe you'll find it useful for yours too!

## License & Copyright

Copyright (c) 2023 Richard Podsada.

This software is released under the MIT License. See [LICENSE](LICENSE.txt) file 
for details.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

