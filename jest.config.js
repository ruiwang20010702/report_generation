/**
 * Jest 配置文件
 * 用于运行集成测试
 */

export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testMatch: [
    '**/tests/**/*.test.ts',
  ],
  collectCoverageFrom: [
    'server/**/*.ts',
    '!server/**/*.d.ts',
    '!server/**/*.test.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000, // 30秒超时
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // 忽略 node_modules 和构建目录
  testPathIgnorePatterns: ['/node_modules/', '/build/', '/dist/'],
  // 启用详细输出
  verbose: true,
};

