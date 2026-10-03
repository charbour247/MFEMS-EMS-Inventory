/** EMS Inventory Google Sheets backend. Deploy as a Web App after editing. */
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
    if (request.action === "ping") return json_({ok:true,spreadsheetName:ss.getName()});
    if (request.action === "getData") return json_({
      ok:true,
      inventory:readObjects_(ss,inventoryTab,false),
      users:readObjects_(ss,usersTab,true)
    });
    if (request.action === "saveInventory") {
      writeObjects_(ss,inventoryTab,["name","cat","loc","qty","par","used","barcode"],request.inventory || []);
      return json_({ok:true});
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
