/**
 * 이미지 파일의 SHA-256 해시 계산 (클라이언트)
 *
 * 브라우저 SubtleCrypto API를 사용해서 파일의 SHA-256 해시를 계산한다.
 * 업로드 전에 중복 체크용으로 사용 — 같은 이미지인지 서버에 물어볼 때
 * 이미지 전체를 보내지 않고 해시만 보내서 트래픽을 절약한다.
 */

/**
 * File 객체 → SHA-256 해시 문자열 (hex)
 *
 * @param file - 해시를 계산할 이미지 파일
 * @returns "a1b2c3..." 형식의 64자 hex 문자열
 */
export async function hashImage(file: File): Promise<string> {
  /* 파일을 ArrayBuffer로 읽기 */
  const buffer = await file.arrayBuffer();

  /* SHA-256 해시 계산 (브라우저 내장 SubtleCrypto) */
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

  /* ArrayBuffer → hex 문자열 변환 */
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}
