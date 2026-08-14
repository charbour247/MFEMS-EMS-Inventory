# EMS Supply Inventory Management System

A mobile-friendly HTML web application for managing EMS supply
inventory. The application includes inventory tracking, low-stock
monitoring, frequently used items, user administration, automatic
barcode assignment, CSV export, and optional Google Sheets database
integration.

## Project Files

-   `index.html` --- Main EMS Inventory web application. The supplied
    `ems_inventory_google_sheets.html` file can be renamed to
    `index.html`.
-   `EMS_Inventory_Google_Apps_Script.gs` --- Google Apps Script backend
    used to connect the web application to Google Sheets.
-   `README.md` --- Project setup and development instructions.

## Features

-   Login screen
-   Mobile-friendly dark blue interface
-   Dashboard with frequently used items
-   Low-stock alerts
-   Current inventory and quantity tracking
-   Searchable inventory
-   Add and adjust inventory items
-   Automatic barcode assignment
-   CSV inventory export
-   User management
-   Administrative database controls
-   Local browser storage fallback
-   Google Sheets database support
-   Manual Google Sheets synchronization
-   Google Sheets connection testing

## Opening the Project in VS Code

1.  Create a project folder, for example `ems-inventory`.
2.  Place the HTML file, Apps Script file, and this README in the
    folder.
3.  Rename `ems_inventory_google_sheets.html` to `index.html` if
    desired.
4.  Open Visual Studio Code.
5.  Select **File \> Open Folder** and choose the project folder.
6.  Open `index.html` to edit the application.

You can open `index.html` directly in a web browser for basic testing. A
local development server such as the VS Code Live Server extension can
also be used.

## First Login

On first use, enter a username and a password of at least eight
characters to create the initial local administrator account.

## Google Sheets Database Setup

The application can use Google Sheets as its primary inventory database
through Google Apps Script.

### 1. Create the Google Sheet

Create a new Google spreadsheet. The Apps Script backend can create the
required tabs automatically.

The application uses these tabs by default:

### Inventory

Columns:

`name | cat | loc | qty | par | used | barcode`

### Users

Columns:

`name | role | status`

## 2. Configure Google Apps Script

1.  Open the Google Sheet.
2.  Select **Extensions \> Apps Script**.
3.  Remove the default sample code.
4.  Open `EMS_Inventory_Google_Apps_Script.gs` in VS Code.
5.  Copy its contents into the Apps Script editor.
6.  Save the project.
7.  Deploy the script as a Web App.
8.  Copy the deployed Web App `/exec` URL.

## 3. Connect the Web App

Open the EMS Inventory application and sign in.

Navigate to:

**Admin Settings \> Google Sheets Database**

Enter:

-   Apps Script Web App URL
-   Google Spreadsheet ID
-   Inventory tab name
-   Users tab name

Enable **Use Google Sheets as primary database**, save the settings, and
select **Test Connection**.

The Spreadsheet ID is the long identifier contained in the Google Sheets
address between `/d/` and `/edit`.

## Database Behavior

When Google Sheets integration is enabled:

-   Inventory can be loaded from Google Sheets.
-   Quantity changes can be written back to Google Sheets.
-   New inventory items can be written to Google Sheets.
-   User changes can be written to Google Sheets.
-   The **Sync** button refreshes application data from Google Sheets.

The application also stores a local browser copy using `localStorage` as
a fallback.

## Barcode Assignment

New inventory items automatically receive an EMS barcode identifier such
as:

`EMS-100001`

The application increments the barcode number when additional inventory
items are created.

## CSV Export

The Inventory page includes an **Export CSV** function. Exported
inventory contains item information including the item name and barcode
number.

## Development Notes

This project is currently a prototype. Before production deployment,
consider adding:

-   Real user authentication
-   Password hashing and secure sessions
-   Role-based permissions
-   Server-side authorization
-   Protected Google Apps Script access
-   Input validation
-   Transaction/audit history
-   Inventory checkout/restock history
-   Barcode/QR camera scanning
-   Multiple station/apparatus support
-   Automated backups
-   Error logging
-   HTTPS hosting

## Suggested Project Structure

``` text
ems-inventory/
├── index.html
├── EMS_Inventory_Google_Apps_Script.gs
└── README.md
```

As the application grows, the HTML, CSS, and JavaScript can be
separated:

``` text
ems-inventory/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── google-apps-script/
│   └── EMS_Inventory_Google_Apps_Script.gs
└── README.md
```

## Important Security Note

Do not treat the prototype login or client-side controls as secure
authentication. Any production EMS inventory system should use proper
authentication and authorization and should restrict who can access or
modify the Google Sheet and Apps Script backend.

## License

No license has been specified for this prototype.
