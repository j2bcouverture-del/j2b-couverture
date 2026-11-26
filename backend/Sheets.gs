// Nouveau projet Apps Script dédié. Les colonnes A à N appartiennent à J2B_V10.
function doPost(e) {
  const p = PropertiesService.getScriptProperties();
  const x = JSON.parse(e.postData.contents);
  const result = v => ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);
  if (!p.getProperty('SECRET') || x.secret !== p.getProperty('SECRET')) return result({error:'auth'});
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = SpreadsheetApp.openById(p.getProperty('SHEET_ID')).getSheetByName('J2B_V10');
    const found = sheet.getRange('A:A').createTextFinder(x.id).matchEntireCell(true).findNext();
    if (!found) {
      const safe = v => /^[=+@\-\t\r]/.test(String(v)) ? "'"+v : String(v ?? '');
      sheet.appendRow([x.id,new Date(),x.form,...['need','city','name','phone','email','details','urgency','consent'].map(k=>safe(x.fields[k])), 'v10']);
      SpreadsheetApp.flush();
    }
    return result({receipt:x.id});
  } finally {lock.releaseLock();}
}
