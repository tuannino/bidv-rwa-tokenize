/**
 * Chữ viết tắt của tên cho ô đầu màn Thông tin tài khoản (FE-UX-05b QĐ-6): tổ chức lấy chữ đầu của hai từ cuối, cá
 * nhân lấy chữ đầu của từ đầu và từ cuối; một từ thì một chữ; rỗng thì chuỗi rỗng. Chỉ là hình đại diện suy từ tên.
 */
export function initialsOf(name: string, organization: boolean): string {
  const words = name.split(/\s+/).filter((word) => word !== '');
  if (words.length === 0) return '';
  const picked = words.length === 1 ? words : organization ? words.slice(-2) : [words[0], words[words.length - 1]];
  return picked.map((word) => Array.from(word)[0]).join('').toLocaleUpperCase('vi-VN');
}
