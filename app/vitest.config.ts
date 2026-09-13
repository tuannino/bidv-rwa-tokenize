import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Cùng ánh xạ như tsconfig paths — test phải nhìn `@bidv/shared` y như app.
      '@bidv/shared': path.resolve(__dirname, '../packages/shared/src/index.ts'),
      // `server-only` ném lỗi khi nạp ngoài môi trường Next; test không cần rào đó.
      'server-only': path.resolve(__dirname, 'test/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
