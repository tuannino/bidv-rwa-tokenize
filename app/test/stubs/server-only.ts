// Rỗng có chủ ý.
// Gói `server-only` thật ném lỗi khi bị nạp ngoài môi trường Next.js — đó là hàng rào
// chống rò code server ra bundle browser. Trong Vitest (chạy ở Node) hàng rào đó không
// cần thiết, nên alias sang file này (xem vitest.config.ts).
export {};
