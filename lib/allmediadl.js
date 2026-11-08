const crypto = require('node:crypto');

class AllMediaDL {
  static BASE_URL = 'https://allmediadl.com';
  static USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  constructor(options = {}) {
    this.timeoutMs = options.timeoutMs || 45000;
    this.pollIntervalMs = options.pollIntervalMs || 1500;
    this.clientId = options.clientId || crypto.randomUUID();
  }

  _getHeaders() {
    return {
      'User-Agent': AllMediaDL.USER_AGENT,
      Referer: `${AllMediaDL.BASE_URL}/`,
      Origin: AllMediaDL.BASE_URL,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*'
    };
  }

  async submitUrl(url) {
    const res = await fetch(`${AllMediaDL.BASE_URL}/api/download`, {
      method: 'POST',
      headers: this._getHeaders(),
      body: JSON.stringify({ url, client: this.clientId }),
      signal: AbortSignal.timeout(20000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.detail || `Job creation failed [HTTP ${res.status}]`);
    }
    const jobId = data.jobs?.[0];
    if (!jobId) throw new Error('No job ID returned by allmediadl.');
    return jobId;
  }

  async chooseFormat(jobId, formatId) {
    const res = await fetch(`${AllMediaDL.BASE_URL}/api/choose`, {
      method: 'POST',
      headers: this._getHeaders(),
      body: JSON.stringify({ job_id: jobId, format_id: formatId, client: this.clientId }),
      signal: AbortSignal.timeout(20000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.detail || `Format selection failed [HTTP ${res.status}]`);
    }
    return data;
  }

  async pollJob(jobId, desiredFormat = 'video') {
    const startTime = Date.now();
    while (Date.now() - startTime < this.timeoutMs) {
      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
      const res = await fetch(
        `${AllMediaDL.BASE_URL}/api/jobs?client=${encodeURIComponent(this.clientId)}`,
        { headers: this._getHeaders(), signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) throw new Error(`Failed to query job status [HTTP ${res.status}]`);
      const data = await res.json();
      const job = (data.jobs || []).find((j) => j.id === jobId);
      if (!job) continue;

      if (job.status === 'awaiting_choice') {
        const formats = job.formats || [];
        const selected =
          formats.find((f) => f.id === desiredFormat || f.kind === desiredFormat) || formats[0];
        await this.chooseFormat(jobId, selected ? selected.id : desiredFormat);
        continue;
      }

      if (job.status === 'done') {
        const fileUrl = `${AllMediaDL.BASE_URL}/api/file/${job.id}?client=${encodeURIComponent(this.clientId)}`;
        const thumbUrl = job.id ? `${AllMediaDL.BASE_URL}/api/thumb/${job.id}` : job.thumbnail;
        return {
          id: job.id,
          title: job.title || 'Media File',
          platform: job.platform || 'Unknown',
          uploader: job.uploader || null,
          durationSeconds: job.duration || 0,
          sizeBytes: job.size || 0,
          filename: job.filename || `${job.id}.mp4`,
          height: job.height || null,
          thumbnailUrl: thumbUrl,
          downloadUrl: fileUrl,
          originalUrl: job.url,
          availableFormats: (job.formats || []).map((f) => ({
            id: f.id,
            kind: f.kind,
            label: f.label_en || f.label_id || f.id
          }))
        };
      }

      if (job.status === 'error' || job.status === 'failed') {
        throw new Error(job.error || 'allmediadl extraction failed.');
      }
    }
    throw new Error(`Extraction timed out after ${this.timeoutMs / 1000} seconds.`);
  }

  async scrape(url, options = {}) {
    const desiredFormat = options.format || 'video';
    const jobId = await this.submitUrl(url);
    return this.pollJob(jobId, desiredFormat);
  }
}

module.exports = { AllMediaDL };
