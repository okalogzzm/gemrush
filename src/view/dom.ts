/** 画面の要素を取り出す（見つからなければすぐ気づけるようにエラーにする） */
export function $(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`画面の要素が見つかりません: ${selector}`);
  return el;
}
