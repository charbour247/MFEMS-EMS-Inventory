// Run with: node tests/cache-regression.js
async function runCacheRegressionTests(source){
  const assert=(condition,message)=>{if(!condition) throw new Error(message);};
  const data={inventory:[{name:"Saved item",qty:42,par:5,used:0,barcode:"TEST-1"}],users:[{name:"Test",username:"test",password:"test-password",role:"Administrator",status:"Active"}]};
  const createStore=()=>{
    const values=new Map();
    return {get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  };
  function open(storage,offline=false,serverData=data){
    const elements=new Map();
    const downloads=[];
    const element=id=>{
      if(!elements.has(id)) elements.set(id,{value:"",textContent:"",innerHTML:"",addEventListener(){},classList:{add(){},remove(){},toggle(){}}});
      return elements.get(id);
    };
    const document={getElementById:element,querySelector:element,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({click(){}})};
    let requests=0;
    const actions=[];
    const fetch=async(url,options)=>{requests++;const request=options.body?JSON.parse(options.body):Object.fromEntries(new URL(url).searchParams);actions.push(request.action);if(offline) throw new Error("Offline");return {ok:true,text:async()=>typeof serverData==="string"?serverData:JSON.stringify(serverData)};};
    let prompts=0;
    const api=new Function("localStorage","document","window","fetch","setTimeout","clearTimeout","setInterval","AbortController","alert","prompt","URL","Blob",source+`
      return {login,sync:syncFromGoogleSheets,apply:applyServerData,key:cacheKey,renderInventory,adjust,exportCSV,
        setRole:role=>{currentSessionUser={role}},
        setSyncEnabled:enabled=>{gsSettings.enabled=enabled},
        updateName:updateItemName,updateCategory:updateItemCategory,
        snapshot:()=>({inventory,users,pending,lastSync,storageAvailable,currentSessionUser}),
        edit:()=>{gsSettings.enabled=false;inventory[0].qty=41;saveInventoryToDatabase();}};
    `)(storage,document,{addEventListener(){}},fetch,()=>1,()=>{},()=>1,class{abort(){}},message=>{throw new Error(message);},()=>{prompts++;return "99";},{createObjectURL:blob=>{downloads.push(blob.parts.join(""));return "blob:test";}},class{constructor(parts){this.parts=parts;}});
    element("username").value="TEST";
    element("password").value="test-password";
    return {...api,element,actions,requests:()=>requests,prompts:()=>prompts,downloads:()=>downloads};
  }
  const storage=createStore();
  const first=open(storage);
  assert(first.snapshot().inventory.length===0,"Fresh device must not display demo inventory");
  await first.login();
  await first.sync(true);
  assert(first.snapshot().currentSessionUser?.username==="test","First login must accept database credentials");
  assert(JSON.parse(storage.getItem(first.key())).inventory[0].qty===42,"First login must persist downloaded inventory");
  first.setRole("Inventory User");
  first.renderInventory();
  assert(!first.element("inventoryBody").innerHTML.includes(">Adjust</button>"),"Non-admins must not see inventory adjustment controls");
  assert(!first.element("inventoryBody").innerHTML.includes("<select") && !first.element("inventoryBody").innerHTML.includes("name-editor"),"Non-admins must not see editable inventory fields");
  await first.adjust(0);
  assert(first.snapshot().inventory[0].qty===42 && first.prompts()===0,"Non-admin inventory adjustment calls must not change quantity or prompt for input");
  const editorStorage=createStore();
  const editor=open(editorStorage,false,{...data,inventory:[{...data.inventory[0],cat:"Supplies"}]});
  editor.apply({...data,inventory:[{...data.inventory[0],cat:"Supplies"}]});
  editor.setRole("Administrator");
  editor.setSyncEnabled(false);
  editor.renderInventory();
  assert(editor.element("inventoryBody").innerHTML.includes("name-editor") && editor.element("inventoryBody").innerHTML.includes("<select") && editor.element("inventoryBody").innerHTML.includes("Supplies"),"Admins must have editable item names and a category dropdown");
  assert(editor.element("inventoryBody").innerHTML.includes("__add_new_category__"),"Admins must be able to add a category from the dropdown");
  await editor.updateName(0,"Updated item");
  await editor.updateCategory(0,"__add_new_category__");
  assert(editor.snapshot().inventory[0].name==="Updated item" && editor.snapshot().inventory[0].cat==="99","Admin item name and new category edits must update inventory");
  assert(JSON.parse(editorStorage.getItem(editor.key())).inventory[0].cat==="99" && editor.snapshot().pending.inventory,"Admin inventory edits must persist locally and queue for sync");
  first.setRole("Administrator");
  first.snapshot().inventory[0].name='Bandage, "sterile"';
  first.exportCSV();
  const csvRows=first.downloads()[0].split("\r\n");
  assert(csvRows.length===2 && csvRows[0]==='"Item Name","Category","Location","Quantity","Par Level","Status","Barcode"',"CSV export must use one header row and one item row per record");
  assert(csvRows[1]==='"Bandage, ""sterile""","","","42","5","OK","TEST-1"',"CSV export must escape field quotes and preserve item details in columns");
  const reopened=open(storage,true);
  assert(reopened.requests()===0 && reopened.snapshot().inventory[0].qty===42,"Reload must restore inventory before requesting the server");
  await reopened.login();
  await reopened.sync(true);
  assert(!reopened.snapshot().currentSessionUser,"Offline login must not authorize from cached credentials");
  reopened.renderInventory();
  assert(reopened.element("inventoryBody").innerHTML.includes("Saved item"),"Offline failure must preserve saved inventory");
  reopened.edit();
  const afterEdit=open(storage,true);
  assert(afterEdit.snapshot().inventory[0].qty===41 && afterEdit.snapshot().pending.inventory,"Unsent edit must survive a reload");
  const oldStore=createStore();
  const dimensions=JSON.parse(first.key().slice("emsCache:v2:".length));
  oldStore.setItem("emsCache:v1:"+JSON.stringify(["https://example.invalid/old-deployment",...dimensions]),JSON.stringify({...data,pending:{inventory:true},lastSync:"2026-01-01T00:00:00.000Z"}));
  const migrated=open(oldStore,true);
  assert(migrated.snapshot().inventory[0].qty===42 && migrated.snapshot().pending.inventory,"Previous deployment cache must migrate with pending edits");
  assert(oldStore.getItem(migrated.key()),"Migration must persist the stable cache");
  const denied=open({length:0,getItem:()=>null,setItem:()=>{throw Error("Quota exceeded");}},true);
  denied.apply(data);
  assert(!denied.snapshot().storageAvailable && denied.element("deviceStorageStatus").textContent.includes("could not be saved"),"Storage failure must remain visible");
  const corrupt=createStore();
  corrupt.setItem(first.key(),"invalid JSON");
  assert(open(corrupt,true).snapshot().inventory.length===0,"Corrupt cache must not create demo inventory");
  for(const serverUsers of [[],[{...data.users[0],password:"changed-password"}],[{...data.users[0],status:"Inactive"}],[{name:"test",password:"test-password",status:"Active"}]]){
    const attempt=open(storage,false,{...data,users:serverUsers});
    await attempt.login();
    assert(!attempt.snapshot().currentSessionUser,"Empty, changed, inactive, or missing-username accounts must be rejected despite cached credentials");
    assert(attempt.actions.join() === "getData","Rejected login must not upload or create accounts");
    assert(attempt.element("loginButton").textContent==="Sign In" && !attempt.element("loginButton").disabled,"Login button must reset after rejection");
  }
  for(const [response,message] of [
    ["<html>Google sign-in required</html>","did not return JSON"],
    [null,"invalid response"],
    [{success:false,message:"Users tab missing"},"Users tab missing"],
    [{error:"Spreadsheet access denied"},"Spreadsheet access denied"]
  ]){
    const attempt=open(storage,false,response);
    await attempt.login();
    assert(!attempt.snapshot().currentSessionUser,"Backend failures must not authorize cached accounts");
    assert(attempt.element("authHint").textContent.includes(message),"Login must explain the backend failure: "+message);
    assert(attempt.actions.join()==="getData","Backend failures must not trigger uploads");
    assert(!attempt.element("loginButton").disabled,"Backend failure must allow retry");
  }
  const changed=open(storage,false,{...data,users:[{...data.users[0],password:"changed-password"}]});
  changed.element("password").value="changed-password";
  await changed.login();
  await changed.sync(true);
  assert(changed.snapshot().currentSessionUser?.username==="test","Updated database password must work despite an old cache");
  assert(changed.element("password").value==="","Successful login must clear the password input");
  return "Passed: database login, rejected stale/inactive/missing accounts, no account creation, connection failure, cache persistence/reload, pending edits, migration, and storage errors.";
}
if(typeof module!=="undefined" && require.main===module){
  const fs=require("node:fs");
  const path=require("node:path");
  const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
  runCacheRegressionTests(html.split("<script>")[1].split("</script>")[0]).then(console.log).catch(error=>{console.error(error);process.exitCode=1;});
}
