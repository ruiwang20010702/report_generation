/**
 * 为 `uuid` 包提供最小类型声明，解决构建时 TS7016 错误。
 * 描述：声明 v4 生成器返回字符串。
 */
declare module 'uuid' {
  /**
   * 生成一个 v4 UUID 字符串
   * @returns 返回符合 RFC4122 的 v4 UUID 字符串
   */
  export function v4(): string;
}