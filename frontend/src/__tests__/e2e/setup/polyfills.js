/**
 * E2Eテスト用ポリフィル
 */

// IntersectionObserver のポリフィル
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
  }

  observe(element) {
    // テスト環境では即座にコールバックを実行
    this.callback([{
      target: element,
      isIntersecting: true,
      intersectionRatio: 1,
      boundingClientRect: element.getBoundingClientRect(),
      intersectionRect: element.getBoundingClientRect(),
      rootBounds: null,
      time: Date.now()
    }]);
  }

  unobserve() {}
  disconnect() {}
};

// ResizeObserver のポリフィル
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }

  observe() {}
  unobserve() {}
  disconnect() {}
};

// matchMedia のポリフィル
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// scrollTo のポリフィル
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: jest.fn()
});

// getComputedStyle のポリフィル
Object.defineProperty(window, 'getComputedStyle', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    getPropertyValue: jest.fn()
  }))
});

// URL.createObjectURL のポリフィル
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: jest.fn(() => 'mock-object-url')
});

Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: jest.fn()
});

// File API のポリフィル
global.File = class File {
  constructor(chunks, filename, options = {}) {
    this.chunks = chunks;
    this.name = filename;
    this.size = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    this.type = options.type || '';
    this.lastModified = options.lastModified || Date.now();
  }
};

global.FileReader = class FileReader {
  constructor() {
    this.readyState = 0;
    this.result = null;
    this.error = null;
    this.onload = null;
    this.onerror = null;
    this.onabort = null;
    this.onloadstart = null;
    this.onloadend = null;
    this.onprogress = null;
  }

  readAsDataURL(file) {
    setTimeout(() => {
      this.result = `data:${file.type};base64,mock-base64-data`;
      this.readyState = 2;
      if (this.onload) this.onload();
    }, 0);
  }

  readAsText(file) {
    setTimeout(() => {
      this.result = 'mock-text-content';
      this.readyState = 2;
      if (this.onload) this.onload();
    }, 0);
  }

  abort() {
    this.readyState = 2;
    if (this.onabort) this.onabort();
  }
};