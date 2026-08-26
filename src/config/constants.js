export const GOAL_STATUS = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETE: 'Complete',
};

export const GOAL_STATUS_OPTIONS = [
  GOAL_STATUS.NOT_STARTED,
  GOAL_STATUS.IN_PROGRESS,
  GOAL_STATUS.COMPLETE,
];

export const DATA_SOURCES = [
  'Outlook Calendar',
  'Azure DevOps',
  'GitHub Commits',
  'Outlook Email',
  'Azure DevOps Commits',
  'MS Teams Messages',
  'Daily Notes',
  'OneNote Priorities',
  'ServiceNow',
];

export const TABS = {
  DAILIES: 'dailies',
  MY_PRIORITIES: 'my-priorities',
  YEARLY_GOALS: 'yearly-goals',
  SETTINGS: 'settings',
};

export const DEFAULT_TAB = TABS.DAILIES;

export const PAGES_PER_PAGE = 10;

// Types that are never "what I am working on". A template is a pattern you
// stamp out rather than work you do: it accumulates no time, so pinning one to
// a clock would be meaningless, and it carries no focus fields at all.
//
// Lives here rather than in focusService because entityTypeService needs it
// too (to decide which types get the focus block) and focusService already
// imports entityTypeService - putting it in either one makes a cycle.
export const UNPINNABLE_TYPE_SLUGS = new Set(['template']);
