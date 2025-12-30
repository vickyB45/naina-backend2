/**
 * Request Queue to prevent rate limiting
 */
class RequestQueue {
  constructor(maxRequestsPerMinute = 15) {
    this.maxRequests = maxRequestsPerMinute;
    this.requests = [];
    this.queue = [];
  }

  async add(fn) {
    // Check if we're within rate limit
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < 60000); // Keep last minute

    if (this.requests.length < this.maxRequests) {
      // Execute immediately
      this.requests.push(now);
      return await fn();
    } else {
      // Queue the request
      console.log('⏳ Request queued due to rate limit...');
      return new Promise((resolve, reject) => {
        this.queue.push({ fn, resolve, reject });
        this.processQueue();
      });
    }
  }

  async processQueue() {
    if (this.queue.length === 0) return;

    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < 60000);

    if (this.requests.length < this.maxRequests) {
      const { fn, resolve, reject } = this.queue.shift();
      this.requests.push(now);
      
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
      
      // Process next in queue
      setTimeout(() => this.processQueue(), 1000);
    } else {
      // Wait before processing
      setTimeout(() => this.processQueue(), 5000);
    }
  }
}

export const geminiQueue = new RequestQueue(15); // 15 requests per minute
