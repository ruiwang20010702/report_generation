/**
 * Jest 配置文件
 * 用于运行集成测试
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/tests/**/*.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      }
    }],
  },
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

