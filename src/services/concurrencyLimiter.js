class ConcurrencyLimiter {
  constructor(limit) {
    this.limit = limit;
    this.active = 0;
    this.queue = [];
  }

  get pending() {
    return this.queue.length;
  }

  async run(fn) {
    if (this.active >= this.limit) {
      await new Promise((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

module.exports = ConcurrencyLimiter;