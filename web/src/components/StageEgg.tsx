/**
 * 스테이지에 표시할 알 (클라이언트 컴포넌트 래퍼)
 * 서버 컴포넌트(dashboard)에서 사용하기 위한 분리.
 */

'use client';

import EggSVG from './EggSVG';

interface StageEggProps {
  patternId: string;
  colors: string[];
}

export default function StageEgg({ patternId, colors }: StageEggProps) {
  return <EggSVG patternId={patternId} colors={colors} size={160} />;
}
