// Run with: node tests/backend-regression.js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','EMS_Inventory_Google_Apps_Script.gs'),'utf8'),context);
function spreadsheet(raw,display=raw) {
  return {getSheetByName:()=>({getDataRange:()=>({getValues:()=>raw,getDisplayValues:()=>display})})};
}
const headers = [' Name ','Username','PASSWORD','role','status'];
const raw = [headers,['Test',123,456,'Administrator','Active']];
const display = [headers,['Test','00123','00456','Administrator','Active']];
const user = context.readObjects_(spreadsheet(raw,display),'Users',true)[0];
assert.equal(user.username,'00123');
assert.equal(user.password,'00456');
const exact = context.readObjects_(spreadsheet([headers,['Test','User',' PassWord ','Administrator','Active']]),'Users',true)[0];
assert.equal(exact.password,' PassWord ');
assert.equal(exact.username,'User');
assert.throws(()=>context.readObjects_({getSheetByName:()=>null},'Users',true),/Missing sheet tab/);
assert.throws(()=>context.readObjects_(spreadsheet([['name']]),'Users',true),/missing headers/);
assert.throws(()=>context.readObjects_(spreadsheet([[...headers,' username ']]),'Users',true),/duplicate account headers/);
const item = context.readObjects_(spreadsheet([['name','qty'],['Bandage',12]]),'Inventory',false)[0];
assert.equal(item.qty,12);
console.log('Passed: normalized headers, displayed credentials, exact password text, missing/duplicate columns, missing tabs, numeric inventory.');
