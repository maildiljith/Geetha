/**
 * FreedcampAPI - Lightweight wrapper for the Freedcamp REST API v1
 * Requests go through the local proxy server (server.js) to bypass CORS.
 */
class FreedcampAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    // On localhost: use the local Node.js proxy (server.js)
    // On Firebase: use the Cloud Function rewrite path
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    this.base = isLocal ? '/api/v1' : '/api/v1';
    this._isLive = !isLocal;
  }

  async _fetch(endpoint, params = {}) {
    const qs = new URLSearchParams({ api_key: this.apiKey, ...params }).toString();
    const res = await fetch(`${this.base}${endpoint}?${qs}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Freedcamp API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async _fetchAll(endpoint, extraParams = {}) {
    const limit = 200;
    let offset = 0;
    let results = [];
    while (true) {
      const data = await this._fetch(endpoint, { ...extraParams, limit, offset });
      const items = this._extractItems(data, endpoint);
      results = results.concat(items);
      if (items.length < limit) break;
      offset += limit;
    }
    return results;
  }

  _extractItems(data, endpoint = '') {
    if (!data || !data.data) return [];
    const d = data.data;
    // Try known keys first based on endpoint, then fall back to first array
    const knownKeys = {
      '/projects':   ['projects'],
      '/milestones': ['milestones'],
      '/tasks':      ['tasks'],
      '/users':      ['users'],
    };
    const path = Object.keys(knownKeys).find(k => endpoint.includes(k));
    const candidates = path ? knownKeys[path] : [];
    for (const key of [...candidates, ...Object.keys(d)]) {
      if (Array.isArray(d[key])) return d[key];
    }
    return [];
  }

  async getProjects() {
    return this._fetchAll('/projects');
  }

  async getMilestones() {
    return this._fetchAll('/milestones');
  }

  async getTasks() {
    return this._fetchAll('/tasks');
  }

  async getUsers() {
    return this._fetchAll('/users');
  }

  async getDashboardData() {
    const projects = await this.getProjects();
    const [milestones, tasks, users] = await Promise.all([
      this.getMilestones(),
      this.getTasks(),
      this.getUsers().catch(() => [])
    ]);
    return { projects, milestones, tasks, users };
  }
}
