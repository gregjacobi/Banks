/**
 * Job Tracker Service
 * Tracks background jobs (report generation, podcast generation) server-side
 * Allows jobs to continue even if client disconnects
 */

class JobTracker {
  constructor() {
    // In-memory job storage (in production, use Redis or database)
    this.jobs = new Map();

    // Clean up old jobs after 24 hours
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldJobs();
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Create a new job
   * @param {string} idrssd - Bank ID
   * @param {string} type - Job type ('report' or 'podcast')
   * @returns {string} jobId
   */
  createJob(idrssd, type) {
    const jobId = `${type}_${idrssd}_${Date.now()}`;

    this.jobs.set(jobId, {
      jobId,
      idrssd,
      type,
      status: 'pending',
      progress: 0,
      message: 'Initializing...',
      createdAt: new Date(),
      updatedAt: new Date(),
      result: null,
      error: null
    });

    console.log(`[JobTracker] Created job: ${jobId}`);
    return jobId;
  }

  /**
   * Update job status
   */
  updateJob(jobId, updates) {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.warn(`[JobTracker] Job not found: ${jobId}`);
      return false;
    }

    Object.assign(job, updates, {
      updatedAt: new Date()
    });

    this.jobs.set(jobId, job);
    return true;
  }

  /**
   * Get job status
   */
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  /**
   * Get latest job for a bank and type
   */
  getLatestJob(idrssd, type) {
    const jobs = Array.from(this.jobs.values())
      .filter(j => j.idrssd === idrssd && j.type === type)
      .sort((a, b) => b.createdAt - a.createdAt);

    return jobs[0] || null;
  }

  /**
   * Mark job as complete
   */
  completeJob(jobId, result) {
    this.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      message: 'Completed successfully',
      result
    });
  }

  /**
   * Mark job as failed
   */
  failJob(jobId, error) {
    this.updateJob(jobId, {
      status: 'failed',
      progress: 0,
      message: error.message || 'Job failed',
      error: error.message
    });
  }

  /**
   * Delete a job
   */
  deleteJob(jobId) {
    this.jobs.delete(jobId);
    console.log(`[JobTracker] Deleted job: ${jobId}`);
  }

  /**
   * Clean up jobs older than 24 hours
   */
  cleanupOldJobs() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.createdAt.getTime() < cutoff) {
        this.jobs.delete(jobId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[JobTracker] Cleaned up ${cleaned} old jobs`);
    }
  }

  /**
   * Get all jobs (for debugging)
   */
  getAllJobs() {
    return Array.from(this.jobs.values());
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance
const jobTracker = new JobTracker();

module.exports = jobTracker;
