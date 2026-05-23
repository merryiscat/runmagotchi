/**
 * 업로드 페이지 (U1) — 스크린샷 전용
 *
 * 런닝 앱 스크린샷을 올리면:
 *   1. SHA-256 해시로 중복 체크 (Gate A)
 *   2. gpt-4.1 vision으로 자동 파싱
 *   3. 결과 프리뷰 (수정 가능)
 *   4. 확정 시 Gate B/C 검증 → Storage 저장 → DB INSERT
 *
 * 수동 입력은 지원하지 않음 — 부정 방지를 위해 스크린샷 필수.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { hashImage } from '@/lib/hash-image';

/* ─── 타입 ─── */

/** VLM 파싱 결과 */
interface ParseResult {
  distance_km: number;
  duration_minutes: number;
  pace: string | null;
  run_date: string | null;
  app_name: string;
  confidence: number;
  /* 캐릭터 진화 속성 */
  time_of_day: string;
  route_type: string;
}

/** Gate C 경고 */
interface Warning {
  rule: string;
  message: string;
}

/** 메타데이터 경고 (편집 감지, 해상도 이상 등) */
interface MetaWarning {
  rule: string;
  message: string;
}

/** 페이지 진행 단계 */
type Step = 'select' | 'analyzing' | 'preview' | 'saving' | 'gate-c';

/* ─── 컴포넌트 ─── */

export default function UploadPage() {
  /* 상태 */
  const [step, setStep] = useState<Step>('select');
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageHash, setImageHash] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [result, setResult] = useState<{ tokens_earned: number } | null>(null);
  const [metaWarnings, setMetaWarnings] = useState<MetaWarning[]>([]);

  /* 수정 가능한 필드 */
  const [editKm, setEditKm] = useState('');
  const [editMin, setEditMin] = useState('');
  const [editPace, setEditPace] = useState('');
  const [editDate, setEditDate] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  /* ── 이미지 선택 → Gate A + VLM 파싱 ── */

  const handleFile = useCallback(async (file: File) => {
    setError('');
    setStep('analyzing');

    try {
      /* 로그인 확인 */
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('로그인 필요'); setStep('select'); return; }

      /* 이미지 프리뷰 생성 */
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);

      /* SHA-256 해시 계산 */
      const hash = await hashImage(file);
      setImageHash(hash);

      /* Gate A: 해시 중복 체크 */
      const hashRes = await fetch('/api/upload-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'check-hash', user_id: user.id, image_hash: hash }),
      });
      const hashData = await hashRes.json();

      if (hashData.duplicate) {
        setError('이미 등록된 스크린샷');
        setStep('select');
        return;
      }

      /* 이미지 → base64 */
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      setImageBase64(base64);

      /* VLM 파싱 */
      const parseRes = await fetch('/api/upload-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'parse', image_base64: base64 }),
      });
      const parseData = await parseRes.json();

      if (parseData.error) {
        setError(parseData.error);
        setStep('select');
        return;
      }

      const p: ParseResult = parseData.parsed;

      /* 메타데이터 경고 저장 (편집 감지, 해상도 이상 등) */
      if (parseData.meta_warnings) {
        setMetaWarnings(parseData.meta_warnings);
      }

      /* confidence 체크 */
      if (p.confidence < 0.5) {
        setError('런닝 스크린샷을 인식할 수 없음. 다른 사진을 올려주세요');
        setStep('select');
        return;
      }

      /* 파싱 결과를 수정 가능 필드에 세팅 */
      setParsed(p);
      setEditKm(p.distance_km.toFixed(2));
      setEditMin(String(p.duration_minutes));
      setEditPace(p.pace || '');
      setEditDate(p.run_date || new Date().toISOString().split('T')[0]);
      setStep('preview');

    } catch (err: any) {
      setError(err.message || '분석 실패');
      setStep('select');
    }
  }, [supabase]);

  /* ── 드래그 앤 드롭 핸들러 ── */

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  /* ── 확정 → Gate B/C + 저장 ── */

  const handleConfirm = useCallback(async (confirmed = false) => {
    setStep('saving');
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('로그인 필요'); setStep('preview'); return; }

      /* 활성 캐릭터 조회 */
      const { data: chars } = await supabase
        .from('characters')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      const character = chars?.[0];
      if (!character) { setError('런닝메이트 없음'); setStep('preview'); return; }

      /* 서버로 확정 요청 */
      const res = await fetch('/api/upload-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'confirm',
          user_id: user.id,
          character_id: character.id,
          image_hash: imageHash,
          image_base64: imageBase64,
          confirmed,
          run: {
            distance_km: parseFloat(editKm),
            duration_minutes: parseInt(editMin, 10),
            pace: editPace || null,
            run_date: editDate,
            time_of_day: parsed?.time_of_day || null,
            route_type: parsed?.route_type || null,
          },
        }),
      });

      const data = await res.json();

      /* Gate B 거부 */
      if (data.gate === 'B') {
        setError(data.error);
        setStep('preview');
        return;
      }

      /* Gate C 경고 → 확인 팝업 */
      if (data.gate === 'C' && data.warnings) {
        setWarnings(data.warnings);
        setStep('gate-c');
        return;
      }

      /* 에러 */
      if (data.error) {
        setError(data.error);
        setStep('preview');
        return;
      }

      /* 성공 */
      setResult(data);
      setTimeout(() => { window.location.href = '/dashboard'; }, 1200);

    } catch (err: any) {
      setError(err.message || '저장 실패');
      setStep('preview');
    }
  }, [supabase, imageHash, imageBase64, editKm, editMin, editPace, editDate]);

  /* ── 코인 미리보기 ── */
  const previewTokens = editKm ? Math.round(parseFloat(editKm) * 10) : 0;

  /* ─── 렌더링 ─── */
  return (
    <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>
      <div style={{ padding: 'var(--s-5)', maxWidth: 720, margin: '0 auto', width: '100%' }}>

        {/* 상단바 — 공통 GNB 사용 불가 (클라이언트 컴포넌트 내부이므로 인라인) */}
        <div className="gnb" style={{ marginBottom: 'var(--s-4)' }}>
          <a href="/dashboard" className="gnb__logo" style={{ textDecoration: 'none' }}>
            ←
          </a>
          <span style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            fontFamily: 'var(--font-penscript)', fontSize: 'var(--fs-md)',
            fontWeight: 700, color: 'var(--ink-strong)',
          }}>
            업로드
          </span>
          <nav className="gnb__nav" style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)' }}>
            <a href="/shop">상점</a>
            <a href="/dashboard">대시보드</a>
            <a href="/profile">프로필</a>
          </nav>
        </div>

        {/* ── Step 1: 사진 선택 ── */}
        {step === 'select' && (
          <>
            <div
              className="dropzone"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileRef.current?.click()}
            >
              <div className="dropzone-icon">↑</div>
              <div className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                런닝 스크린샷을 드래그하거나 클릭해서 선택
              </div>
              <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                Strava · 나이키런 · 삼성헬스 · Garmin
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </>
        )}

        {/* ── Step 2: 분석 중 ── */}
        {step === 'analyzing' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 'var(--s-4)', padding: 'var(--s-7) 0',
          }}>
            {/* 이미지 썸네일 */}
            {imagePreview && (
              <img src={imagePreview} alt="업로드 이미지"
                style={{ maxWidth: 200, maxHeight: 300, border: '1px solid var(--line)', objectFit: 'contain' }} />
            )}
            <div className="text-sm" style={{ color: 'var(--ink-muted)' }}>분석 중...</div>
            <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>최대 7초</div>
          </div>
        )}

        {/* ── Step 3: 결과 프리뷰 ── */}
        {step === 'preview' && parsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>

            {/* 이미지 + 앱 인식 결과 */}
            <div style={{ display: 'flex', gap: 'var(--s-4)', alignItems: 'flex-start' }}>
              {imagePreview && (
                <img src={imagePreview} alt="스크린샷"
                  style={{ width: 100, height: 140, objectFit: 'cover', border: '1px solid var(--line)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div className="text-xs text-muted" style={{ marginBottom: 'var(--s-2)' }}>
                  인식 앱: {parsed.app_name}
                  {parsed.confidence < 0.7 && ' · 인식이 불확실합니다. 확인 후 수정해주세요'}
                </div>
                {/* 수정 가능 필드 */}
                <div className="field">
                  <div className="field__label">거리 (km)</div>
                  <input className="input" type="number" step="0.01"
                    value={editKm} onChange={e => setEditKm(e.target.value)} />
                </div>
                <div className="field">
                  <div className="field__label">시간 (분)</div>
                  <input className="input" type="number"
                    value={editMin} onChange={e => setEditMin(e.target.value)} />
                </div>
                <div className="field">
                  <div className="field__label">페이스 (/km)</div>
                  <input className="input" type="text" placeholder="05:32"
                    value={editPace} onChange={e => setEditPace(e.target.value)} />
                </div>
                <div className="field">
                  <div className="field__label">날짜</div>
                  <input className="input" type="date"
                    value={editDate} onChange={e => setEditDate(e.target.value)} />
                </div>
              </div>
            </div>

            {/* 메타데이터 경고 (편집 의심, 오래된 스크린샷 등) */}
            {metaWarnings.length > 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 'var(--s-2)',
              }}>
                {metaWarnings.map(w => (
                  <div key={w.rule} style={{
                    padding: 'var(--s-2) var(--s-3)',
                    background: 'var(--clay-soft)',
                    border: '1px solid var(--line)',
                    borderLeft: '3px solid var(--hwang)',
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--ink-muted)',
                  }}>
                    {w.message}
                  </div>
                ))}
              </div>
            )}

            {/* 코인 미리보기 */}
            {previewTokens > 0 && (
              <div style={{
                padding: 'var(--s-3) var(--s-4)', background: 'var(--clay-soft)',
                border: '1px solid var(--line-soft)', fontSize: 'var(--fs-sm)',
                display: 'flex', justifyContent: 'space-between',
                fontFamily: 'var(--font-handwriting)',
              }}>
                <span style={{ color: 'var(--ink-muted)' }}>획득 코인</span>
                <span style={{ fontWeight: 700 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 14, height: 14, borderRadius: '50%',
                    background: 'var(--hwang)', color: 'var(--on-hwang)',
                    fontSize: 9, fontWeight: 900, fontFamily: 'serif', lineHeight: 1,
                    marginRight: 4,
                  }}>₩</span>
                  {previewTokens}
                </span>
              </div>
            )}

            <div className="text-xs text-muted">확정 후 수정·삭제 불가</div>

            <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
              <button className="btn" style={{ flex: 1 }}
                onClick={() => { setStep('select'); setParsed(null); setError(''); setMetaWarnings([]); }}>
                다시 선택
              </button>
              <button className="btn btn--primary" style={{ flex: 2 }}
                onClick={() => handleConfirm()}>
                확정
              </button>
            </div>
          </div>
        )}

        {/* ── Step: 저장 중 ── */}
        {step === 'saving' && (
          <div style={{ textAlign: 'center', padding: 'var(--s-7) 0' }}>
            <div className="text-sm text-muted">저장 중...</div>
          </div>
        )}

        {/* ── Step: Gate C 확인 팝업 ── */}
        {step === 'gate-c' && (
          <div style={{
            padding: 'var(--s-5)', border: '2px solid var(--line-strong)',
            background: 'var(--surface)',
          }}>
            <div className="fw-bold mb-3" style={{ fontSize: 'var(--fs-lg)' }}>
              이 기록이 맞나요?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)', marginBottom: 'var(--s-4)' }}>
              {warnings.map(w => (
                <div key={w.rule} style={{
                  padding: 'var(--s-2) var(--s-3)',
                  background: 'var(--clay-soft)',
                  border: '1px solid var(--line)',
                  fontSize: 'var(--fs-sm)',
                }}>
                  {w.message}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
              <button className="btn" style={{ flex: 1 }}
                onClick={() => { setStep('preview'); setWarnings([]); }}>
                취소
              </button>
              <button className="btn btn--primary" style={{ flex: 2 }}
                onClick={() => handleConfirm(true)}>
                맞아요
              </button>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div style={{
            marginTop: 'var(--s-4)', padding: 'var(--s-3) var(--s-4)',
            border: '2px solid var(--ink-strong)', background: 'var(--surface)',
            fontSize: 'var(--fs-sm)', color: 'var(--ink-strong)', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* 성공 메시지 */}
        {result && (
          <div style={{
            marginTop: 'var(--s-4)', padding: 'var(--s-3) var(--s-4)',
            border: '2px solid var(--cheong)', background: 'var(--surface)',
            fontSize: 'var(--fs-sm)', textAlign: 'center',
            fontFamily: 'var(--font-handwriting)',
          }}>
            +{result.tokens_earned} 코인 획득
          </div>
        )}
      </div>
    </div>
  );
}
