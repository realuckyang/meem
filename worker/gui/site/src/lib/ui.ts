export const pageX = 'px-5 sm:px-8 lg:px-[72px]';

export const fmtDate = (s: number) => {
  try { return new Date(s * 1000).toLocaleDateString('zh-CN'); } catch { return ''; }
};
