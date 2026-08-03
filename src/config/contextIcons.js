// Curated Bootstrap Icons offered by the icon picker for Contexts and Context
// Folders (Settings > Contexts). Fixed set rather than free text - the value
// lands in a `class="bi ${icon}"` attribute, so it's validated against this
// list server-side before being stored.
export const CONTEXT_ICONS = [
  { key: 'briefcase', icon: 'bi-briefcase', label: 'Briefcase' },
  { key: 'house', icon: 'bi-house', label: 'House' },
  { key: 'star', icon: 'bi-star', label: 'Star' },
  { key: 'heart', icon: 'bi-heart', label: 'Heart' },
  { key: 'gear', icon: 'bi-gear', label: 'Gear' },
  { key: 'flag', icon: 'bi-flag', label: 'Flag' },
  { key: 'book', icon: 'bi-book', label: 'Book' },
  { key: 'laptop', icon: 'bi-laptop', label: 'Laptop' },
  { key: 'globe', icon: 'bi-globe', label: 'Globe' },
  { key: 'rocket', icon: 'bi-rocket', label: 'Rocket' },
  { key: 'palette', icon: 'bi-palette', label: 'Palette' },
  { key: 'tools', icon: 'bi-tools', label: 'Tools' },
  { key: 'shield', icon: 'bi-shield', label: 'Shield' },
  { key: 'tag', icon: 'bi-tag', label: 'Tag' },
  { key: 'bookmark', icon: 'bi-bookmark', label: 'Bookmark' },
  { key: 'folder2', icon: 'bi-folder2', label: 'Folder' },
  { key: 'people', icon: 'bi-people', label: 'People' },
  { key: 'calendar', icon: 'bi-calendar', label: 'Calendar' },
  { key: 'lightning', icon: 'bi-lightning', label: 'Lightning' },
  { key: 'camera', icon: 'bi-camera', label: 'Camera' },
  { key: 'music-note', icon: 'bi-music-note', label: 'Music' },
  { key: 'controller', icon: 'bi-controller', label: 'Controller' },
  { key: 'tree', icon: 'bi-tree', label: 'Tree' },
  { key: 'piggy-bank', icon: 'bi-piggy-bank', label: 'Piggy Bank' },
];

export const VALID_CONTEXT_ICONS = new Set(CONTEXT_ICONS.map(i => i.icon));
