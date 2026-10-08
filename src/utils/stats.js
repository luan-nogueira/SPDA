import { checklistData } from '../data/checklist';

export const TOTAL_QUESTIONS = checklistData.reduce((acc, s) => acc + s.questions.length, 0);

export const isPendingPhoto = (url) => typeof url === 'string' && url.startsWith('data:');

export function posteStats(poste) {
  const answers = Object.values(poste?.answers || {});
  const answered = answers.filter((a) => a?.status).length;
  const bad = answers.filter((a) => a?.status === 'nao-conforme').length;
  const allPhotos = [...answers, ...Object.values(poste?.details?.inventory || {})].map((a) => a?.photo);
  const photos = allPhotos.filter(Boolean).length;
  const pendingPhotos = allPhotos.filter(isPendingPhoto).length;
  const pct = TOTAL_QUESTIONS ? Math.round((answered / TOTAL_QUESTIONS) * 100) : 0;
  return { answered, total: TOTAL_QUESTIONS, pct, bad, photos, pendingPhotos };
}

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export function globalStats(postes) {
  let pctSum = 0, bad = 0, complete = 0, cableCamera = 0, cableSpda = 0, located = 0, pendingPhotos = 0;
  postes.forEach((p) => {
    const s = posteStats(p);
    pctSum += s.pct;
    bad += s.bad;
    pendingPhotos += s.pendingPhotos;
    if (s.pct === 100) complete += 1;
    cableCamera += num(p.distances?.camera);
    cableSpda += num(p.distances?.spda);
    if (p.location) located += 1;
  });
  return {
    total: postes.length,
    avgPct: postes.length ? Math.round(pctSum / postes.length) : 0,
    complete,
    bad,
    cableCamera,
    cableSpda,
    cableTotal: cableCamera + cableSpda,
    located,
    pendingPhotos,
  };
}

export const STATUS_LABEL = {
  conforme: 'Conforme',
  'nao-conforme': 'Não Conforme',
  na: 'N/A',
};
