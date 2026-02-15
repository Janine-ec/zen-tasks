// =============================================================
// Configuration - All configurable values in one place
// Update these after setting up n8n and Supabase
// =============================================================

const CONFIG = {
  // n8n webhook base URL (no trailing slash)
  N8N_BASE_URL: 'https://janine-nz.app.n8n.cloud/webhook',

  // n8n webhook paths
  ENDPOINTS: {
    TASK_AGENT:  '/task-agent',
    LIST_TASKS:  '/list-tasks',
  },

  // Default user ID (matches seed.sql)
  USER_ID: '00000000-0000-0000-0000-000000000001',
};
