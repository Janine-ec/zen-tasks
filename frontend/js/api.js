// =============================================================
// API layer - all fetch() calls to n8n webhooks
// =============================================================

const API = {
  /**
   * Send a message in the "add task" conversation.
   * The AI may respond with clarifying questions or confirm the task was added.
   * @param {string} message - User's message
   * @param {object[]} history - Conversation history so far
   * @returns {Promise<object>} { reply, done, task? }
   */
  async addTask(message, history) {
    const res = await fetch(
      CONFIG.N8N_BASE_URL + CONFIG.ENDPOINTS.ADD_TASK,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: CONFIG.USER_ID,
          message,
          history,
        }),
      }
    );
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  },

  /**
   * Send a message in the "clear task" conversation.
   * AI determines intent: complete, suggest, or delete.
   * @param {string} message - User's message
   * @param {object[]} history - Conversation history so far
   * @returns {Promise<object>} { reply, done, action?, task? }
   */
  async clearTask(message, history) {
    const res = await fetch(
      CONFIG.N8N_BASE_URL + CONFIG.ENDPOINTS.CLEAR_TASK,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: CONFIG.USER_ID,
          message,
          history,
        }),
      }
    );
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  },

  /**
   * List tasks by status.
   * @param {string} status - 'pending', 'completed', etc.
   * @returns {Promise<object[]>} Array of tasks
   */
  async listTasks(status) {
    const res = await fetch(
      CONFIG.N8N_BASE_URL + CONFIG.ENDPOINTS.LIST_TASKS,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: CONFIG.USER_ID,
          status,
        }),
      }
    );
    if (!res.ok) throw new Error('Failed to load tasks');
    return res.json();
  },
};
