// =============================================================
// API layer - all fetch() calls to n8n webhooks
// =============================================================

const API = {
  /**
   * Send a message to the unified Task Agent.
   * Handles both adding and clearing/managing tasks.
   * @param {string} message - User's message
   * @param {object[]} history - Conversation history so far
   * @param {string} mode - 'add' or 'clear' (hint for AI)
   * @returns {Promise<object>} { replies: [...], done: true/false }
   */
  async sendMessage(message, history, mode) {
    const res = await fetch(
      CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.TASK_AGENT,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: CONFIG.USER_ID,
          message,
          history,
          mode,
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
      CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.LIST_TASKS,
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
