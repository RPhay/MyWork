function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function showImportResult(message, isError) {
  const el = document.getElementById('importResult');
  el.textContent = message;
  el.className = `small mb-2 ${isError ? 'text-danger' : 'text-success'}`;
}

async function importBackup() {
  const fileInput = document.getElementById('importFileInput');
  const file = fileInput.files[0];

  if (!file) {
    app.notify('Choose a backup file first', 'warning');
    return;
  }

  let payload;
  try {
    const text = await readFileAsText(file);
    payload = JSON.parse(text);
  } catch (error) {
    console.error('Error reading backup file:', error);
    showImportResult('That file is not valid JSON', true);
    return;
  }

  if (!payload || !payload.tables) {
    showImportResult('That file doesn\'t look like a MyWork backup', true);
    return;
  }

  const confirmed = await app.confirm(
    'This will REPLACE ALL data currently in this database with the contents of this file. This cannot be undone. Continue?'
  );
  if (!confirmed) return;

  showImportResult('Importing...', false);

  try {
    const response = await fetch('/api/backup/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (result.success) {
      showImportResult(`Imported ${result.data.rowsImported} rows across ${result.data.tablesImported} tables.`, false);
      app.notify('Database imported successfully', 'success');
    } else {
      showImportResult('Import failed: ' + result.message, true);
    }
  } catch (error) {
    console.error('Error importing backup:', error);
    showImportResult('Error importing backup', true);
  }
}

function initBackup() {
  document.getElementById('importBackupBtn').addEventListener('click', importBackup);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBackup);
} else {
  initBackup();
}
