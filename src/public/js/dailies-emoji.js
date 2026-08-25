// Emoji picker for Dailies rows and for emoji fields in the type editor.
// Split out of dailies.js - see dashboard.ejs for load order. State here
// (emojiPicker*) is touched by nothing outside this file.

// Shared by every "Oh!" emoji picker in the app: row cells (Work Items, Templates)
// PATCH the server immediately; form fields (inside the Work Item/Template modals)
// just fill in a hidden input for whenever the form itself gets saved.

let emojiPickerEntityId = null;
let emojiPickerEntityType = null;
let emojiPickerFieldTarget = null;

const EMOJI_ENTITY_CONFIG = {
  "work-item": {
    endpoint: (id) => `/api/dailies/${id}/emoji`,
    reload: () => loadWorkItems(),
  },
  template: {
    endpoint: (id) => `/api/daily-templates/${id}/emoji`,
    reload: () => window.GenericEntityTabs?.refresh("template"),
  },
};

function showEmojiPicker(x, y, entityId, entityType = "work-item") {
  emojiPickerEntityId = entityId;
  emojiPickerEntityType = entityType;
  emojiPickerFieldTarget = null;
  const popover = document.getElementById("emojiPickerPopover");
  popover.style.left = `${x}px`;
  popover.style.top = `${y}px`;
  popover.classList.remove("d-none");
}

// Opens the same picker for a plain form field: `inputId` is the hidden input
// that holds the value to submit, `buttonId` is the visible button showing it.
function showEmojiPickerForField(x, y, inputId, buttonId) {
  emojiPickerEntityId = null;
  emojiPickerEntityType = "field";
  emojiPickerFieldTarget = { inputId, buttonId };
  const popover = document.getElementById("emojiPickerPopover");
  popover.style.left = `${x}px`;
  popover.style.top = `${y}px`;
  popover.classList.remove("d-none");
}

function updateEmojiFieldButton(buttonId, emoji) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.textContent = emoji || "Pick an emoji";
  btn.classList.toggle("text-muted", !emoji);
}

function hideEmojiPicker() {
  emojiPickerEntityId = null;
  emojiPickerEntityType = null;
  emojiPickerFieldTarget = null;
  document.getElementById("emojiPickerPopover").classList.add("d-none");
}

async function selectEmoji(emoji) {
  if (emojiPickerEntityType === "field") {
    const target = emojiPickerFieldTarget;
    hideEmojiPicker();
    if (!target) return;
    document.getElementById(target.inputId).value = emoji;
    updateEmojiFieldButton(target.buttonId, emoji);
    return;
  }

  if (!emojiPickerEntityId) return;
  const entityId = emojiPickerEntityId;
  const config = EMOJI_ENTITY_CONFIG[emojiPickerEntityType];
  hideEmojiPicker();
  if (!config) return;

  try {
    const response = await app.fetchRaw(config.endpoint(entityId), {
      method: "PATCH",
      
      body: JSON.stringify({ emoji }) });

    const result = await response.json();
    if (result.success) {
      config.reload();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error setting emoji:", error);
    app.notify("Error setting emoji", "danger");
  }
}

function initEmojiPicker() {
  const popover = document.getElementById("emojiPickerPopover");
  if (!popover) return;

  // Also opened from Templates (a different tab pane). Left inside #tab-dailies,
  // it's a descendant of a display:none ancestor whenever Dailies isn't the
  // active tab, so it would silently fail to render there - move it to the body.
  document.body.appendChild(popover);

  popover.addEventListener("click", (e) => {
    const tabBtn = e.target.closest("[data-emoji-tab]");
    if (tabBtn) {
      const category = tabBtn.dataset.emojiTab;
      popover
        .querySelectorAll("#emojiPickerTabs [data-emoji-tab]")
        .forEach((b) => b.classList.remove("active"));
      tabBtn.classList.add("active");
      popover.querySelectorAll(".emoji-picker-grid").forEach((panel) => {
        panel.classList.toggle("d-none", panel.dataset.emojiPanel !== category);
      });
      return;
    }

    const btn = e.target.closest(".emoji-picker-btn");
    if (!btn) return;
    selectEmoji(btn.dataset.emoji);
  });

  document.addEventListener("click", (e) => {
    // The editor's status picker. Writes the hidden input the form reads, then
    // moves the box - a button click fires no change event, so the form's
    // dirty-tracking has to be told explicitly or Save stays disabled.
    const statusPick = e.target.closest('[data-action="pick-status"]');
    if (statusPick) {
      const picker = statusPick.closest("[data-status-picker]");
      const inputId = picker?.dataset.statusPicker;
      const input = inputId && document.getElementById(inputId);
      if (input) {
        input.value = statusPick.dataset.value || "";
        markStatusChoice(inputId, input.value);
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return;
    }

    const fieldBtn = e.target.closest('[data-action="pick-emoji-field"]');
    if (fieldBtn) {
      const rect = fieldBtn.getBoundingClientRect();
      showEmojiPickerForField(
        rect.left,
        rect.bottom + 4,
        fieldBtn.dataset.input,
        fieldBtn.id,
      );
      return;
    }

    if (
      !popover.classList.contains("d-none") &&
      !popover.contains(e.target) &&
      !e.target.closest('[data-action="pick-emoji"]')
    ) {
      hideEmojiPicker();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideEmojiPicker();
  });
}
