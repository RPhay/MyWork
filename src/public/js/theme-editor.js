// Theme Editor - Manage application appearance preferences

function loadThemePreferences() {
  const prefs = JSON.parse(localStorage.getItem('themePreferences') || '{}');
  return {
    mode: prefs.mode || 'system',
    accentColor: prefs.accentColor || 'blue',
    fontSize: prefs.fontSize || 100,
    compactMode: prefs.compactMode || false,
    // Dropped here before, so it never round-tripped: this function returns a
    // NEW object with only these fixed keys, so any save that ran through it
    // (theme mode, accent color, font size, compact mode - all of them build
    // `prefs` from this function) wrote dateFormat right back out of storage.
    // 'YYYY-MM-DD' matches genericEntity.js's dateFormatPreference() default.
    dateFormat: prefs.dateFormat || 'YYYY-MM-DD'
  };
}

function saveThemePreferences(prefs) {
  localStorage.setItem('themePreferences', JSON.stringify(prefs));
  applyThemePreferences(prefs);
}

function applyThemePreferences(prefs) {
  // Apply theme mode
  if (prefs.mode === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else if (prefs.mode === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  // Apply font size
  document.documentElement.style.fontSize = (16 * prefs.fontSize / 100) + 'px';

  // Apply compact mode
  if (prefs.compactMode) {
    document.body.classList.add('compact-mode');
  } else {
    document.body.classList.remove('compact-mode');
  }

  // Apply accent color (stored for future use)
  document.documentElement.setAttribute('data-accent-color', prefs.accentColor);
}

function initThemeEditor() {
  const prefs = loadThemePreferences();

  // Date display format. Kept with the other display preferences: it changes
  // only how a stored date is rendered, never what is stored.
  const dateFormat = document.getElementById('dateFormatSelect');
  if (dateFormat) {
    dateFormat.value = prefs.dateFormat || 'YYYY-MM-DD';
    dateFormat.addEventListener('change', () => {
      prefs.dateFormat = dateFormat.value;
      saveThemePreferences(prefs);
      app.notify('Date format updated', 'success');
    });
  }

  // Set current theme mode
  document.querySelector(`input[name="theme"][value="${prefs.mode}"]`).checked = true;

  // Set current accent color
  document.querySelector(`input[name="accentColor"][value="${prefs.accentColor}"]`).checked = true;

  // Set current font size
  const fontSizeSlider = document.getElementById('fontSizeSlider');
  const fontSizeLabel = document.getElementById('fontSizeLabel');
  fontSizeSlider.value = prefs.fontSize;
  fontSizeLabel.textContent = prefs.fontSize + '%';

  // Set compact mode
  document.getElementById('compactMode').checked = prefs.compactMode;

  // Theme mode change
  document.querySelectorAll('input[name="theme"]').forEach(radio => {
    radio.addEventListener('change', () => {
      prefs.mode = radio.value;
      saveThemePreferences(prefs);
    });
  });

  // Accent color change
  document.querySelectorAll('input[name="accentColor"]').forEach(radio => {
    radio.addEventListener('change', () => {
      prefs.accentColor = radio.value;
      saveThemePreferences(prefs);
    });
  });

  // Font size change
  fontSizeSlider.addEventListener('input', () => {
    prefs.fontSize = parseInt(fontSizeSlider.value);
    fontSizeLabel.textContent = prefs.fontSize + '%';
    applyThemePreferences(prefs);
  });

  // Compact mode change
  document.getElementById('compactMode').addEventListener('change', (e) => {
    prefs.compactMode = e.target.checked;
    saveThemePreferences(prefs);
  });

  // Save button
  document.getElementById('saveThemeBtn').addEventListener('click', () => {
    saveThemePreferences(prefs);
    app.notify('Theme preferences saved', 'success');
  });

  // Reset button
  document.getElementById('resetThemeBtn').addEventListener('click', async () => {
    if (await app.confirm('Reset theme to default settings?', 'Reset Theme')) {
      const defaultPrefs = {
        mode: 'system',
        accentColor: 'blue',
        fontSize: 100,
        compactMode: false
      };
      saveThemePreferences(defaultPrefs);
      location.reload();
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThemeEditor);
} else {
  initThemeEditor();
}
