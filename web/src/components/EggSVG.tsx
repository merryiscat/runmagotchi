/**
 * 알 SVG 컴포넌트
 *
 * 알 외곽선(검정) + 무늬 도형 8개 + 색상 순환 배정.
 * 무늬 20종, 각 무늬마다 도형 8개가 알 안에 배치됨.
 * colors 배열에 따라 도형 fill을 순환 배정:
 *   1색 → 8개 전부 같은 색
 *   2색 → 번갈아
 *   3색 → 순환
 */

'use client';

/** 도형 8개의 위치 (알 내부, 0~100 좌표계) */
const POSITIONS = [
  { x: 30, y: 20 }, { x: 60, y: 18 },
  { x: 22, y: 40 }, { x: 52, y: 38 },
  { x: 72, y: 42 }, { x: 28, y: 60 },
  { x: 55, y: 62 }, { x: 42, y: 78 },
];

/** 무늬별 도형 렌더 함수. 각 도형은 (cx, cy) 중심, fill 색상을 받음 */
const PATTERN_RENDERERS: Record<string, (cx: number, cy: number, fill: string, i: number) => React.JSX.Element> = {
  /* 01 물방울 */ '01': (cx, cy, fill, i) => <circle key={i} cx={cx} cy={cy} r={8} fill={fill} />,
  /* 02 별 */     '02': (cx, cy, fill, i) => <polygon key={i} points={star(cx, cy, 9, 4)} fill={fill} />,
  /* 03 물결 */   '03': (cx, cy, fill, i) => <ellipse key={i} cx={cx} cy={cy} rx={10} ry={5} fill={fill} />,
  /* 04 하트 */   '04': (cx, cy, fill, i) => <path key={i} d={heart(cx, cy)} fill={fill} />,
  /* 05 꽃 */     '05': (cx, cy, fill, i) => <g key={i}>{[0,72,144,216,288].map((a,j) => <circle key={j} cx={cx + 5*Math.cos(a*Math.PI/180)} cy={cy + 5*Math.sin(a*Math.PI/180)} r={3.5} fill={fill} />)}<circle cx={cx} cy={cy} r={3} fill={fill} /></g>,
  /* 06 삼각형 */ '06': (cx, cy, fill, i) => <polygon key={i} points={`${cx},${cy-9} ${cx-8},${cy+6} ${cx+8},${cy+6}`} fill={fill} />,
  /* 07 세로줄 */ '07': (cx, cy, fill, i) => <rect key={i} x={cx-3} y={cy-10} width={6} height={20} rx={3} fill={fill} />,
  /* 08 쉐브론 */ '08': (cx, cy, fill, i) => <polyline key={i} points={`${cx-8},${cy-4} ${cx},${cy+5} ${cx+8},${cy-4}`} fill="none" stroke={fill} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />,
  /* 09 다이아 */  '09': (cx, cy, fill, i) => <polygon key={i} points={`${cx},${cy-9} ${cx+7},${cy} ${cx},${cy+9} ${cx-7},${cy}`} fill={fill} />,
  /* 10 소용돌이 */ '10': (cx, cy, fill, i) => <circle key={i} cx={cx} cy={cy} r={7} fill="none" stroke={fill} strokeWidth={3} />,
  /* 11 초승달 */  '11': (cx, cy, fill, i) => <path key={i} d={`M${cx-2},${cy-8} A8,8,0,1,1,${cx-2},${cy+8} A5,5,0,1,0,${cx-2},${cy-8}`} fill={fill} />,
  /* 12 나뭇잎 */  '12': (cx, cy, fill, i) => <ellipse key={i} cx={cx} cy={cy} rx={5} ry={9} fill={fill} transform={`rotate(${30 * (i % 3) - 30}, ${cx}, ${cy})`} />,
  /* 13 구름 */    '13': (cx, cy, fill, i) => <g key={i}><circle cx={cx-4} cy={cy} r={5} fill={fill}/><circle cx={cx+4} cy={cy} r={5} fill={fill}/><circle cx={cx} cy={cy-3} r={5} fill={fill}/></g>,
  /* 14 번개 */    '14': (cx, cy, fill, i) => <polygon key={i} points={`${cx-2},${cy-9} ${cx+5},${cy-1} ${cx},${cy-1} ${cx+2},${cy+9} ${cx-5},${cy+1} ${cx},${cy+1}`} fill={fill} />,
  /* 15 비늘 */    '15': (cx, cy, fill, i) => <path key={i} d={`M${cx-8},${cy} Q${cx},${cy-10} ${cx+8},${cy} Q${cx},${cy+4} ${cx-8},${cy}`} fill={fill} />,
  /* 16 컨페티 */  '16': (cx, cy, fill, i) => <rect key={i} x={cx-4} y={cy-6} width={8} height={12} rx={2} fill={fill} transform={`rotate(${20 * i}, ${cx}, ${cy})`} />,
  /* 17 크로스 */  '17': (cx, cy, fill, i) => <g key={i}><rect x={cx-2} y={cy-8} width={4} height={16} rx={2} fill={fill}/><rect x={cx-8} y={cy-2} width={16} height={4} rx={2} fill={fill}/></g>,
  /* 18 발자국 */  '18': (cx, cy, fill, i) => <g key={i}><ellipse cx={cx} cy={cy+2} rx={5} ry={6} fill={fill}/><circle cx={cx-4} cy={cy-6} r={2.5} fill={fill}/><circle cx={cx+4} cy={cy-6} r={2.5} fill={fill}/></g>,
  /* 19 버블 */    '19': (cx, cy, fill, i) => <circle key={i} cx={cx} cy={cy} r={6 + (i % 3) * 2} fill={fill} opacity={0.7} />,
  /* 20 깃털 */    '20': (cx, cy, fill, i) => <ellipse key={i} cx={cx} cy={cy} rx={4} ry={10} fill={fill} transform={`rotate(${15 * (i % 4) - 30}, ${cx}, ${cy})`} />,
};

/** 별 좌표 계산 */
function star(cx: number, cy: number, outer: number, inner: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 2) + (i * Math.PI / 5);
    return `${cx + r * Math.cos(a)},${cy - r * Math.sin(a)}`;
  }).join(' ');
}

/** 하트 경로 */
function heart(cx: number, cy: number): string {
  return `M${cx},${cy+7} C${cx-10},${cy-3} ${cx-5},${cy-11} ${cx},${cy-5} C${cx+5},${cy-11} ${cx+10},${cy-3} ${cx},${cy+7}Z`;
}

interface EggSVGProps {
  /** 무늬 ID ("01"~"20") */
  patternId: string;
  /** 색상 배열 (1~3개). 도형에 순환 배정 */
  colors: string[];
  /** SVG 크기 (px) */
  size?: number;
}

export default function EggSVG({ patternId, colors, size = 240 }: EggSVGProps) {
  const renderer = PATTERN_RENDERERS[patternId] || PATTERN_RENDERERS['01'];

  return (
    <svg viewBox="0 0 100 120" width={size} height={size * 1.2}
         xmlns="http://www.w3.org/2000/svg">
      {/* 알 외곽: 흰 배경 + 검정 테두리 */}
      <ellipse cx={50} cy={58} rx={38} ry={48}
               fill="white" stroke="black" strokeWidth={2.5} />

      {/* 무늬 도형 8개 — 색상 순환 배정 */}
      {POSITIONS.map((pos, i) => {
        const fill = colors.length > 0
          ? colors[i % colors.length]
          : '#CCCCCC';
        return renderer(pos.x, pos.y, fill, i);
      })}
    </svg>
  );
}
