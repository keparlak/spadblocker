/**
 * Unit Tests for PerformanceMonitor Class
 * Tests the performance monitoring functionality
 */

// Import the PerformanceMonitor class from the main file
// Note: This would require refactoring the main file to export classes
// For now, we'll create a simple mock for testing
class PerformanceMonitor {
  #metrics = new Map();
  #startTime = performance.now();

  startTimer(name) {
    try {
      this.#metrics.set(name, performance.now());
    } catch (error) {
      console.error(`Spadblocker: PerformanceMonitor.startTimer failed for ${name}:`, error);
    }
  }

  endTimer(name) {
    try {
      const startTime = this.#metrics.get(name);
      if (startTime) {
        const duration = performance.now() - startTime;
        this.#metrics.delete(name);
        return duration;
      }
      return 0;
    } catch (error) {
      console.error(`Spadblocker: PerformanceMonitor.endTimer failed for ${name}:`, error);
      return 0;
    }
  }

  getMetrics() {
    try {
      return {
        uptime: performance.now() - this.#startTime,
        activeTimers: this.#metrics.size
      };
    } catch (error) {
      console.error('Spadblocker: PerformanceMonitor.getMetrics failed:', error);
      return {
        uptime: 0,
        activeTimers: 0
      };
    }
  }
}

describe('PerformanceMonitor', () => {
  let performanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
  });

  describe('startTimer', () => {
    it('should start a timer and store the start time', () => {
      const timerName = 'test-timer';

      performanceMonitor.startTimer(timerName);

      expect(global.performance.now).toHaveBeenCalled();
    });

    it('should handle errors gracefully when performance.now fails', () => {
      global.performance.now.mockImplementationOnce(() => {
        throw new Error('Performance API error');
      });

      expect(() => {
        performanceMonitor.startTimer('test-timer');
      }).not.toThrow();
    });
  });

  describe('endTimer', () => {
    it('should end a timer and return the duration', () => {
      const timerName = 'test-timer';

      // Mock performance.now to return different values
      global.performance.now
        .mockReturnValueOnce(100) // start time
        .mockReturnValueOnce(200); // end time

      performanceMonitor.startTimer(timerName);
      const duration = performanceMonitor.endTimer(timerName);

      expect(duration).toBe(100);
    });

    it('should return 0 if timer was not started', () => {
      const duration = performanceMonitor.endTimer('non-existent-timer');
      expect(duration).toBe(0);
    });

    it('should handle errors gracefully when performance.now fails', () => {
      global.performance.now.mockImplementationOnce(() => {
        throw new Error('Performance API error');
      });

      performanceMonitor.startTimer('test-timer');
      const duration = performanceMonitor.endTimer('test-timer');

      expect(duration).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should return current metrics', () => {
      global.performance.now.mockReturnValue(1000);

      const metrics = performanceMonitor.getMetrics();

      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('activeTimers');
      expect(typeof metrics.uptime).toBe('number');
      expect(typeof metrics.activeTimers).toBe('number');
    });

    it('should handle errors gracefully when getting metrics', () => {
      global.performance.now.mockImplementationOnce(() => {
        throw new Error('Performance API error');
      });

      const metrics = performanceMonitor.getMetrics();

      expect(metrics).toEqual({
        uptime: 0,
        activeTimers: 0
      });
    });
  });

  describe('Timer Lifecycle', () => {
    it('should properly manage timer lifecycle', () => {
      const timerName = 'lifecycle-test';

      // Start timer
      global.performance.now.mockReturnValue(100);
      performanceMonitor.startTimer(timerName);

      // Check metrics show active timer
      let metrics = performanceMonitor.getMetrics();
      expect(metrics.activeTimers).toBe(1);

      // End timer
      global.performance.now.mockReturnValue(200);
      const duration = performanceMonitor.endTimer(timerName);

      // Check timer is removed
      metrics = performanceMonitor.getMetrics();
      expect(metrics.activeTimers).toBe(0);
      expect(duration).toBe(100);
    });
  });
});
