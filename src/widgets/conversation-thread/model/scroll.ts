/**
 * Сохранение якоря прокрутки при подгрузке более старых сообщений сверху:
 * на сколько вырос контейнер, на столько сдвигается прокрутка, и сообщение,
 * которое читал пользователь, остаётся на месте.
 */
export function anchoredScrollTop(
  previousTop: number,
  previousHeight: number,
  nextHeight: number,
): number {
  return previousTop + Math.max(0, nextHeight - previousHeight)
}
