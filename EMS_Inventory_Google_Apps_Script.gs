/** EMS Inventory Google Sheets backend. Deploy as a Web App after editing. */
const LOW_STOCK_EMAIL = {
  recipient:"dfoley@martinsvilleva.gov",
  sheetId:"1HNm7G6D82PjMFFK1AjRqp57Sfc_SnCuWuIj0dT15vu0",
  inventoryTab:"Inventory"
};

// Run once from the Apps Script editor as the account that should send alerts.
function setupLowStockAlerts() {
  SpreadsheetApp.openById(LOW_STOCK_EMAIL.sheetId);
  MailApp.getRemainingDailyQuota(); // Request email authorization before the timer runs.
  const existing = ScriptApp.getProjectTriggers().filter(trigger=>trigger.getHandlerFunction()==="checkLowStockAlerts");
  if (!existing.length) ScriptApp.newTrigger("checkLowStockAlerts").timeBased().everyMinutes(5).create();
}

function checkLowStockAlerts() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    sendLowStockAlerts_(SpreadsheetApp.openById(LOW_STOCK_EMAIL.sheetId));
  } finally { lock.releaseLock(); }
}

// Caller holds the script lock so saves and timer checks share alert history safely.
function sendLowStockAlerts_(ss) {
    const config = LOW_STOCK_EMAIL;
    const sheet = ss.getSheetByName(config.inventoryTab);
    if (!sheet) throw new Error("Missing inventory tab: "+config.inventoryTab);
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(value=>String(value).trim().toLowerCase());
    for (const header of ["name","loc","qty","par","barcode"]) {
      if (headers.indexOf(header)<0 || headers.indexOf(header)!==headers.lastIndexOf(header)) throw new Error("Inventory requires one column named "+header);
    }
    const items = readObjects_(ss,config.inventoryTab,false);
    const prefix = "lowStockAlert:"+config.sheetId+":"+config.inventoryTab+":";
    const store = PropertiesService.getScriptProperties();
    const previous = store.getProperties();
    const low = new Map();
    const barcodes = new Set();
    for (const item of items) {
      const barcode = String(item.barcode??"").trim();
      if (!barcode || barcodes.has(barcode)) throw new Error("Each inventory item needs a unique barcode for low-stock alerts.");
      barcodes.add(barcode);
      if (String(item.qty??"").trim()==="" || String(item.par??"").trim()==="" || !Number.isFinite(Number(item.qty)) || !Number.isFinite(Number(item.par))) throw new Error("Invalid quantity or par level for "+barcode);
      if (Number(item.qty)<Number(item.par)) low.set(prefix+barcode,item);
    }
    const newlyLow = [...low].filter(([key])=>!previous[key]);
    if (newlyLow.length) {
      MailApp.sendEmail({
        to:config.recipient,
        subject:"MFEMS Inventory: "+newlyLow.length+" item(s) below par",
        body:"The following inventory is below par:\n\n"+newlyLow.map(([,item])=>
          String(item.name)+"\nLocation: "+String(item.loc||"Unspecified")+"\nQuantity: "+item.qty+" | Par: "+item.par+"\nBarcode: "+item.barcode
        ).join("\n\n")+"\n\nSpreadsheet: https://docs.google.com/spreadsheets/d/"+config.sheetId+"/edit\n\nItems are checked after inventory saves and approximately every five minutes. Another alert is enabled after a check observes the item at or above par."
      });
      // Record only after sending succeeds, so failures can retry on the next check.
      for (const [key] of newlyLow) store.setProperty(key,"sent");
    }
    for (const key of Object.keys(previous)) {
      if (key.startsWith(prefix) && !low.has(key)) store.deleteProperty(key);
    }
}

function doPost(e) {
  try {
    const request = JSON.parse(e && e.postData && e.postData.contents || "{}");
    if (!request.sheetId) return json_({ok:false,error:"Missing sheetId"});
    const ss = SpreadsheetApp.openById(request.sheetId);
    const inventoryTab = request.inventoryTab || "Inventory";
    const usersTab = request.usersTab || "Users";
    if (request.action === "registerUser") {
      const name = String(request.name || "").trim();
      const username = String(request.username || "").trim();
      const password = typeof request.password === "string" ? request.password : "";
      if (!name || name.length > 100) throw new Error("Enter a name of at most 100 characters.");
      if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) throw new Error("Username must be 3–40 letters, numbers, dots, underscores, or hyphens.");
      if (password.length < 8) throw new Error("Password must have at least 8 characters.");
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        const users = readObjects_(ss,usersTab,true);
        if (users.some(user=>String(user.username).trim().toLowerCase()===username.toLowerCase())) {
          throw new Error("That username is already taken. Choose another username.");
        }
        const sheet = ss.getSheetByName(usersTab);
        const headers = sheet.getDataRange().getDisplayValues()[0].map(value=>String(value).trim().toLowerCase());
        const user = {name,username,password,role:"Inventory User",status:"Active"};
        const row = headers.map(header=>{
          const value = user[header] || "";
          return value.startsWith("=") ? "'"+value : value;
        });
        const range = sheet.getRange(sheet.getLastRow()+1,1,1,headers.length);
        range.setNumberFormat("@");
        range.setValues([row]);
        SpreadsheetApp.flush();
        return json_({ok:true});
      } finally { lock.releaseLock(); }
    }
    if (request.action === "changePassword") {
      const username = String(request.username || "").trim().toLowerCase();
      const currentPassword = request.currentPassword;
      const newPassword = request.newPassword;
      if (!username || typeof currentPassword !== "string" || !currentPassword) throw new Error("Enter your current password.");
      if (typeof newPassword !== "string" || newPassword.length < 8) throw new Error("Password must have at least 8 characters.");
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        readObjects_(ss,usersTab,true); // Validate account headers before writing.
        const sheet = ss.getSheetByName(usersTab);
        const values = sheet.getDataRange().getDisplayValues();
        const headers = values[0].map(value=>String(value).trim().toLowerCase());
        const matches = values.slice(1).map((row,index)=>({row,index})).filter(entry=>String(entry.row[headers.indexOf("username")]).trim().toLowerCase()===username);
        if (matches.length !== 1 || String(matches[0].row[headers.indexOf("status")]).trim().toLowerCase() !== "active" || matches[0].row[headers.indexOf("password")] !== currentPassword) {
          throw new Error("Current password is incorrect or account is inactive. Sign in again if your account has changed.");
        }
        const cell = sheet.getRange(matches[0].index+2,headers.indexOf("password")+1,1,1);
        cell.setNumberFormat("@");
        cell.setValues([[newPassword.startsWith("=") ? "'"+newPassword : newPassword]]);
        SpreadsheetApp.flush();
        return json_({ok:true});
      } finally { lock.releaseLock(); }
    }
    if (request.action === "ping") return json_({ok:true,spreadsheetName:ss.getName()});
    if (request.action === "getData") return json_({
      ok:true,
      inventory:readObjects_(ss,inventoryTab,false),
      users:readObjects_(ss,usersTab,true)
    });
    if (request.action === "saveInventory") {
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        writeObjects_(ss,inventoryTab,["name","cat","loc","qty","par","used","barcode"],request.inventory || []);
        SpreadsheetApp.flush();
        if (request.sheetId===LOW_STOCK_EMAIL.sheetId && inventoryTab===LOW_STOCK_EMAIL.inventoryTab) {
          try {
            sendLowStockAlerts_(ss);
          } catch (err) {
            // Inventory is already saved. Keep the save successful; the timer retries email.
            console.error("Low-stock notification failed: "+String(err && err.message || err));
          }
        }
        return json_({ok:true});
      } finally { lock.releaseLock(); }
    }
    if (request.action === "saveUsers") {
      writeObjects_(ss,usersTab,["name","username","password","role","status"],request.users || []);
      return json_({ok:true});
    }
    return json_({ok:false,error:"Unknown action"});
  } catch (err) {
    return json_({ok:false,error:String(err && err.message ? err.message : err)});
  }
}
function doGet(e) {
  const params = e && e.parameter || {};
  if (params.action === "registerUser") return json_({ok:false,error:"Account creation requires POST."});
  if (params.action === "changePassword") return json_({ok:false,error:"Password changes require POST."});
  if (!params.action) return json_({ok:true,service:"EMS Inventory Google Sheets API"});
  return doPost({postData:{contents:JSON.stringify(params)}});
}
function readObjects_(ss,name,isUsers) {
  // A read must not silently create an empty Users tab after a typo.
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet tab "'+name+'". Check the configured tab name.');
  const range = sheet.getDataRange();
  const values = isUsers ? range.getDisplayValues() : range.getValues();
  const headers = values[0].map(v=>String(v).trim().toLowerCase());
  if (isUsers) {
    const required = ["name","username","password","role","status"];
    const missing = required.filter(h=>!headers.includes(h));
    if (missing.length) throw new Error('Users tab "'+name+'" is missing headers: '+missing.join(", "));
    if (required.some(h=>headers.indexOf(h)!==headers.lastIndexOf(h))) {
      throw new Error('Users tab "'+name+'" has duplicate account headers.');
    }
  }
  if (headers.every(h=>h==="")) return [];
  return values.slice(1).filter(row=>row.some(v=>v!=="")).map(row=>{
    const obj = {};
    headers.forEach((header,i)=>{if(header) obj[header]=row[i];});
    return obj;
  });
}
function writeObjects_(ss,name,headers,rows) {
  if (!Array.isArray(rows) || rows.some(row=>!row || typeof row!=="object" || Array.isArray(row))) {
    throw new Error("Expected an array of records.");
  }
  const values = rows.map(row=>headers.map(h=>row[h]??""));
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.clearContents();
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  if (rows.length) {
    // Preserve credential strings when they look like numbers or dates.
    for (const key of ["username","password"]) {
      const column = headers.indexOf(key);
      if (column>=0) sheet.getRange(2,column+1,rows.length,1).setNumberFormat("@");
    }
    sheet.getRange(2,1,rows.length,headers.length).setValues(values);
  }
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1,headers.length);
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
