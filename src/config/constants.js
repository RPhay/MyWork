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
