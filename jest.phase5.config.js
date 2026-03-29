module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': '<rootDir>/__tests__/mocks/react-native.ts',
    '\\.(png|jpg|jpeg|gif|svg|webp)$': '<rootDir>/__tests__/mocks/fileMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/phase5.jest.setup.ts'],
  transformIgnorePatterns: ['/node_modules/'],
};
