// =============================================================
// Configuration - All configurable values in one place
// Update these after setting up n8n and Supabase
// =============================================================

const CONFIG = {
  // Vercel API base URL (no trailing slash)
  API_BASE_URL: 'https://zen-tasker-drab.vercel.app/api',

  // API endpoint paths
  ENDPOINTS: {
    TASK_AGENT:   '/task-agent',
    LIST_TASKS:   '/list-tasks',
    UPDATE_TASK:  '/update-task',
  },

  // Default user ID (matches seed.sql)
  USER_ID: '00000000-0000-0000-0000-000000000001',
};
