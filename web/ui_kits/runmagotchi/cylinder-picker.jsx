// cylinder-picker.jsx — 3D 실린더(원통) 형태의 알 선택 컴포넌트.
//
// 동작:
//   • 알이 N개일 때 원통 둘레에 360/N 도 간격으로 배치됨.
//   • 알은 항상 카메라(사용자)를 바라봄(빌보드). 원통은 회전하지만 알 자체는 회전하지 않음 →
//     측면에 가도 알 모양이 그대로 보이고, 깊이감만 살아남.
//   • 클릭 → 가장 짧은 경로로 회전해서 그 알을 정면(0°)으로.
//   • 좌우 드래그(마우스/터치) → 실시간 회전, 손 떼면 가장 가까운 알로 스냅.
//
// 좌표:
//   각 알의 effectiveAngle = baseAngle + cylinderRotation
//   baseAngle 은 알의 고정 위치 (0번: -120°, 1번: 0°, 2번: +120°)
//   초기 cylinderRotation = 0 → 화면 좌→우 순서가 [1번, 2번, 3번]
//   3번을 누르면 cylinderRotation = -120 → 좌→우 순서가 [2번, 3번, 1번]
//
// 트랜스폼:
//   transform: rotateY(eff) translateZ(R) rotateY(-eff)
//   - 처음 rotateY(-eff): 알을 역회전해서 카메라를 바라보게
//   - translateZ(R): 알을 원통 표면으로 밀어냄
//   - rotateY(eff): 원통 둘레의 해당 각도 위치로 회전
//   (CSS transform 은 오른쪽부터 적용)

const N_EGGS = 3;
const STEP_ANGLE = 360 / N_EGGS; // 120
const RADIUS = 240;              // 원통 반지름 (px)
const PERSPECTIVE = 900;         // 깊이감
const DRAG_SENSITIVITY = 0.6;    // px → deg

// baseAngle 배열: 좌→우 순서가 [0,1,2] (라벨 1·2·3) 가 되도록
//   idx 0 → -120° (왼쪽)
//   idx 1 →    0° (가운데)
//   idx 2 → +120° (오른쪽)
const BASE_ANGLES = [-STEP_ANGLE, 0, STEP_ANGLE];

// 회전각을 -180~180 범위로 정규화 (가장 가까운 표현)
function normalize(deg) {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

// target 을 current 와 가까운 표현으로 변환 (감기/풀리 방지)
function shortestPath(current, target) {
  let delta = normalize(target - current);
  return current + delta;
}

function CylinderPicker({ palettes, labels, onPick }) {
  const [rotation, setRotation] = React.useState(0);   // 누적 회전 (스냅 후)
  const [dragDelta, setDragDelta] = React.useState(0); // 드래그 중 일시 회전
  const [dragging, setDragging] = React.useState(false);

  const dragStartX = React.useRef(0);
  const dragStartY = React.useRef(0);
  const movedRef = React.useRef(false); // 진짜 드래그인지 (threshold 넘었는지)
  const containerRef = React.useRef(null);
  const DRAG_THRESHOLD = 6; // px

  // 현재 시각적으로 적용된 총 회전
  const visualRotation = rotation + dragDelta;

  // 정면에 가장 가까운 알의 인덱스 계산
  const frontIdx = React.useMemo(() => {
    let bestIdx = 0;
    let bestAbs = Infinity;
    BASE_ANGLES.forEach((base, i) => {
      const eff = normalize(base + visualRotation);
      const a = Math.abs(eff);
      if (a < bestAbs) { bestAbs = a; bestIdx = i; }
    });
    return bestIdx;
  }, [visualRotation]);

  // 특정 알을 정면으로
  function rotateTo(idx) {
    const targetRotation = -BASE_ANGLES[idx];
    const next = shortestPath(rotation, targetRotation);
    setRotation(next);
    setDragDelta(0);
  }

  // 포인터 다운 — 드래그 후보로만 표시. 실제 캡처는 threshold 넘었을 때.
  function onPointerDown(e) {
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    movedRef.current = false;
    setDragging(true);
  }
  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - dragStartX.current;
    const dy = e.clientY - dragStartY.current;
    // threshold 넘으면 그때부터 진짜 드래그로 간주 + 포인터 캡처
    if (!movedRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      movedRef.current = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (movedRef.current) {
      setDragDelta(dx * DRAG_SENSITIVITY);
    }
  }
  function onPointerUp(e) {
    if (!dragging) return;
    setDragging(false);

    if (!movedRef.current) {
      // 클릭으로 간주 — 포인터 위치 아래 슬롯 찾아서 회전
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const slot = el?.closest?.('.cyl-slot');
      if (slot) {
        const idx = Number(slot.dataset.idx);
        if (!Number.isNaN(idx)) rotateTo(idx);
      }
      setDragDelta(0);
      return;
    }

    // 드래그 종료 → 가장 가까운 알로 스냅
    const total = rotation + dragDelta;
    const snapped = Math.round(total / STEP_ANGLE) * STEP_ANGLE;
    setRotation(snapped);
    setDragDelta(0);
  }

  return (
    <div className="cyl-wrap">
      <div
        ref={containerRef}
        className="cyl-scene"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="cyl-stage"
          style={{ perspective: `${PERSPECTIVE}px` }}
        >
          <div className="cyl-drum">
            {palettes.map((p, i) => {
              const base = BASE_ANGLES[i];
              const eff = base + visualRotation; // 시각적 각도
              const effNorm = normalize(eff);
              // 정면에서 멀어질수록 어두워지고 약간 축소
              const t = Math.abs(effNorm) / 180; // 0~1
              const dim = 1 - t * 0.55;          // 1 → 0.45
              const scale = 1 - t * 0.15;        // 1 → 0.85
              const isFront = i === frontIdx;
              return (
                <div
                  key={i}
                  data-idx={i}
                  className={`cyl-slot ${isFront ? 'is-front' : ''}`}
                  style={{
                    transform: `rotateY(${eff}deg) translateZ(${RADIUS}px) rotateY(${-eff}deg) scale(${scale})`,
                    filter: `brightness(${dim})`,
                    zIndex: Math.round(1000 - Math.abs(effNorm)),
                    transition: dragging && movedRef.current
                      ? 'none'
                      : 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1), filter 380ms ease-out',
                  }}
                >
                  <div className="cyl-egg">
                    <Egg palette={p} />
                  </div>
                  <div className="cyl-slot-label">{labels[i]}</div>
                </div>
              );
            })}
          </div>

          {/* 원통 표면을 암시하는 가이드 라인들 */}
          <div className="cyl-rail cyl-rail--top" />
          <div className="cyl-rail cyl-rail--bottom" />
        </div>

        {/* 바닥 그림자 */}
        <div className="cyl-floor" />
      </div>

      {/* 캡션 */}
      <div className="cyl-caption">
        <div className="text-xs text-muted">좌우로 드래그하거나 옆 알을 누르세요</div>
      </div>

      <div className="cyl-confirm">
        <Button
          variant="primary"
          size="lg"
          onClick={() => onPick?.(frontIdx, palettes[frontIdx])}
          style={{ minWidth: 220 }}
        >
          선택
        </Button>
      </div>
    </div>
  );
}

Object.assign(window, { CylinderPicker });
