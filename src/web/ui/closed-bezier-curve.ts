import './closed-bezier-curve.css';

type CurvePoint = {
  id: string;
  x: number;
  y: number;
  inAngle: number;
  inLength: number;
  outAngle: number;
  outLength: number;
  linked: boolean;
};

type DragState =
  | {
      pointerId: number;
      pointId: string;
      kind: 'anchor' | 'in-handle' | 'out-handle';
    }
  | null;

const VIEWBOX_WIDTH = 1400;
const VIEWBOX_HEIGHT = 900;
const DEFAULT_HANDLE_LENGTH = 72;
const PATH_STROKE = '#7dd3fc';
const GRID_MINOR = 40;
const GRID_MAJOR = 200;

const root = document.getElementById('closed-bezier-curve-app');
if (!root) {
  throw new Error('closed bezier curve root bulunamadi.');
}

function requireElement<T extends Element>(value: T | null, message: string): T {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

root.innerHTML = `
  <div class="curve-shell">
    <section class="curve-stage">
      <svg class="curve-svg" viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}" xmlns="http://www.w3.org/2000/svg" aria-label="Closed bezier editor"></svg>
      <div class="curve-overlay">
        <h1>Closed Bezier Curve</h1>
        <p>Boşluğa tıkla: yeni nokta. Noktaya tıkla: seç. Handle sürükle: yön değiştir.</p>
      </div>
    </section>
    <aside class="curve-panel">
      <section class="curve-card">
        <h2>Actions</h2>
        <div class="curve-actions">
          <button class="curve-button curve-button--primary" type="button" data-action="export-svg">Export SVG</button>
          <button class="curve-button curve-button--ghost" type="button" data-action="delete-selected">Delete Selected</button>
          <button class="curve-button curve-button--danger" type="button" data-action="clear-points">Delete All</button>
        </div>
      </section>

      <section class="curve-card">
        <h2>Selected Point</h2>
        <div class="curve-grid">
          <div class="curve-field">
            <label for="anchorX">Anchor X</label>
            <input id="anchorX" name="anchorX" type="number" step="1" />
          </div>
          <div class="curve-field">
            <label for="anchorY">Anchor Y</label>
            <input id="anchorY" name="anchorY" type="number" step="1" />
          </div>
          <div class="curve-field">
            <label for="inAngle">In Angle</label>
            <input id="inAngle" name="inAngle" type="number" step="0.1" />
          </div>
          <div class="curve-field">
            <label for="inLength">In Length</label>
            <input id="inLength" name="inLength" type="number" step="0.1" min="0" />
          </div>
          <div class="curve-field">
            <label for="outAngle">Out Angle</label>
            <input id="outAngle" name="outAngle" type="number" step="0.1" />
          </div>
          <div class="curve-field">
            <label for="outLength">Out Length</label>
            <input id="outLength" name="outLength" type="number" step="0.1" min="0" />
          </div>
          <div class="curve-field curve-field--full">
            <div class="curve-toggle-row">
              <input id="linkedHandles" name="linkedHandles" type="checkbox" />
              <label for="linkedHandles">Linked Handles</label>
            </div>
          </div>
        </div>
      </section>

      <section class="curve-card">
        <h2>Readout</h2>
        <pre class="curve-readout"></pre>
      </section>
    </aside>
  </div>
`;

const svg = requireElement(
  root.querySelector<SVGSVGElement>('.curve-svg'),
  'closed bezier curve svg kurulamadı.'
);
const readout = requireElement(
  root.querySelector<HTMLPreElement>('.curve-readout'),
  'closed bezier curve readout kurulamadı.'
);
const exportButton = requireElement(
  root.querySelector<HTMLButtonElement>('[data-action="export-svg"]'),
  'closed bezier curve export button kurulamadı.'
);
const deleteSelectedButton = requireElement(
  root.querySelector<HTMLButtonElement>('[data-action="delete-selected"]'),
  'closed bezier curve delete selected button kurulamadı.'
);
const clearPointsButton = requireElement(
  root.querySelector<HTMLButtonElement>('[data-action="clear-points"]'),
  'closed bezier curve clear points button kurulamadı.'
);
const anchorXInput = requireElement(
  root.querySelector<HTMLInputElement>('#anchorX'),
  'closed bezier curve anchorX input kurulamadı.'
);
const anchorYInput = requireElement(
  root.querySelector<HTMLInputElement>('#anchorY'),
  'closed bezier curve anchorY input kurulamadı.'
);
const inAngleInput = requireElement(
  root.querySelector<HTMLInputElement>('#inAngle'),
  'closed bezier curve inAngle input kurulamadı.'
);
const inLengthInput = requireElement(
  root.querySelector<HTMLInputElement>('#inLength'),
  'closed bezier curve inLength input kurulamadı.'
);
const outAngleInput = requireElement(
  root.querySelector<HTMLInputElement>('#outAngle'),
  'closed bezier curve outAngle input kurulamadı.'
);
const outLengthInput = requireElement(
  root.querySelector<HTMLInputElement>('#outLength'),
  'closed bezier curve outLength input kurulamadı.'
);
const linkedHandlesInput = requireElement(
  root.querySelector<HTMLInputElement>('#linkedHandles'),
  'closed bezier curve linkedHandles input kurulamadı.'
);

const state: {
  points: CurvePoint[];
  selectedPointId: string | null;
  dragState: DragState;
} = {
  points: [],
  selectedPointId: null,
  dragState: null,
};

function createPoint(x: number, y: number): CurvePoint {
  const index = state.points.length + 1;
  return {
    id: `point-${Date.now()}-${index}`,
    x,
    y,
    inAngle: 180,
    inLength: DEFAULT_HANDLE_LENGTH,
    outAngle: 0,
    outLength: DEFAULT_HANDLE_LENGTH,
    linked: true,
  };
}

function clampToViewBox(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function normalizeAngle(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function toHandlePoint(point: CurvePoint, kind: 'in' | 'out'): { x: number; y: number } {
  const angle = kind === 'in' ? point.inAngle : point.outAngle;
  const length = kind === 'in' ? point.inLength : point.outLength;
  const rad = degToRad(angle);
  return {
    x: point.x + Math.cos(rad) * length,
    y: point.y + Math.sin(rad) * length,
  };
}

function describePath(points: CurvePoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  const first = points[0];
  let path = `M ${first.x} ${first.y}`;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const outHandle = toHandlePoint(current, 'out');
    const inHandle = toHandlePoint(next, 'in');
    path += ` C ${outHandle.x} ${outHandle.y}, ${inHandle.x} ${inHandle.y}, ${next.x} ${next.y}`;
  }
  path += ' Z';
  return path;
}

function getSelectedPoint(): CurvePoint | null {
  return state.points.find((point) => point.id === state.selectedPointId) ?? null;
}

function updateSelectedControls(): void {
  const selected = getSelectedPoint();
  const disabled = !selected;

  for (const input of [anchorXInput, anchorYInput, inAngleInput, inLengthInput, outAngleInput, outLengthInput, linkedHandlesInput]) {
    input.disabled = disabled;
  }
  deleteSelectedButton.disabled = disabled;

  if (!selected) {
    anchorXInput.value = '';
    anchorYInput.value = '';
    inAngleInput.value = '';
    inLengthInput.value = '';
    outAngleInput.value = '';
    outLengthInput.value = '';
    linkedHandlesInput.checked = false;
    return;
  }

  anchorXInput.value = `${Math.round(selected.x)}`;
  anchorYInput.value = `${Math.round(selected.y)}`;
  inAngleInput.value = `${Number(selected.inAngle.toFixed(2))}`;
  inLengthInput.value = `${Number(selected.inLength.toFixed(2))}`;
  outAngleInput.value = `${Number(selected.outAngle.toFixed(2))}`;
  outLengthInput.value = `${Number(selected.outLength.toFixed(2))}`;
  linkedHandlesInput.checked = selected.linked;
}

function updateReadout(): void {
  const selected = getSelectedPoint();
  const path = describePath(state.points);
  readout.textContent = [
    `points: ${state.points.length}`,
    `selected: ${selected?.id ?? 'none'}`,
    selected
      ? `anchor=(${selected.x.toFixed(1)}, ${selected.y.toFixed(1)}) in=${selected.inAngle.toFixed(1)}deg/${selected.inLength.toFixed(1)} out=${selected.outAngle.toFixed(1)}deg/${selected.outLength.toFixed(1)}`
      : 'anchor: none',
    `path: ${path || 'empty'}`,
  ].join('\n');
}

function renderGrid(): string {
  const parts: string[] = [];

  for (let x = 0; x <= VIEWBOX_WIDTH; x += GRID_MINOR) {
    const major = x % GRID_MAJOR === 0;
    parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${VIEWBOX_HEIGHT}" stroke="${major ? 'rgba(125,211,252,0.12)' : 'rgba(255,255,255,0.05)'}" stroke-width="1" />`);
  }
  for (let y = 0; y <= VIEWBOX_HEIGHT; y += GRID_MINOR) {
    const major = y % GRID_MAJOR === 0;
    parts.push(`<line x1="0" y1="${y}" x2="${VIEWBOX_WIDTH}" y2="${y}" stroke="${major ? 'rgba(125,211,252,0.12)' : 'rgba(255,255,255,0.05)'}" stroke-width="1" />`);
  }

  return parts.join('');
}

function renderSvg(): void {
  const selected = getSelectedPoint();
  const path = describePath(state.points);
  const selectedPointMarkup = selected
    ? (() => {
        const inHandle = toHandlePoint(selected, 'in');
        const outHandle = toHandlePoint(selected, 'out');
        return `
          <g>
            <line x1="${selected.x}" y1="${selected.y}" x2="${inHandle.x}" y2="${inHandle.y}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 6" />
            <line x1="${selected.x}" y1="${selected.y}" x2="${outHandle.x}" y2="${outHandle.y}" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6 6" />
            <circle cx="${inHandle.x}" cy="${inHandle.y}" r="8" fill="#f59e0b" stroke="#fff" stroke-width="2" data-role="in-handle" data-point-id="${selected.id}" />
            <circle cx="${outHandle.x}" cy="${outHandle.y}" r="8" fill="#38bdf8" stroke="#fff" stroke-width="2" data-role="out-handle" data-point-id="${selected.id}" />
          </g>
        `;
      })()
    : '';

  const pointsMarkup = state.points
    .map((point, index) => {
      const isSelected = point.id === state.selectedPointId;
      return `
        <g>
          <circle cx="${point.x}" cy="${point.y}" r="12" fill="${isSelected ? '#eef2f6' : '#111827'}" stroke="${isSelected ? '#38bdf8' : '#7dd3fc'}" stroke-width="3" data-role="anchor" data-point-id="${point.id}" />
          <text x="${point.x}" y="${point.y - 18}" fill="#eef2f6" font-size="18" font-weight="700" text-anchor="middle">${index + 1}</text>
        </g>
      `;
    })
    .join('');

  svg.innerHTML = `
    <rect x="0" y="0" width="${VIEWBOX_WIDTH}" height="${VIEWBOX_HEIGHT}" fill="#0a0e13" data-role="background" />
    <g pointer-events="none">${renderGrid()}</g>
    ${path ? `<path d="${path}" fill="rgba(125, 211, 252, 0.12)" stroke="${PATH_STROKE}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />` : ''}
    ${selectedPointMarkup}
    ${pointsMarkup}
  `;

  updateSelectedControls();
  updateReadout();
}

function getSvgCoordinates(event: PointerEvent): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH;
  const y = ((event.clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT;
  return {
    x: clampToViewBox(x, VIEWBOX_WIDTH),
    y: clampToViewBox(y, VIEWBOX_HEIGHT),
  };
}

function updatePoint(pointId: string, updater: (point: CurvePoint) => CurvePoint): void {
  state.points = state.points.map((point) => (point.id === pointId ? updater(point) : point));
  renderSvg();
}

function handlePointerDown(event: PointerEvent): void {
  const target = event.target as HTMLElement | SVGElement;
  const role = target.getAttribute('data-role');
  const pointId = target.getAttribute('data-point-id');

  if (role === 'anchor' && pointId) {
    state.selectedPointId = pointId;
    state.dragState = {
      pointerId: event.pointerId,
      pointId,
      kind: 'anchor',
    };
    svg.setPointerCapture(event.pointerId);
    renderSvg();
    return;
  }

  if ((role === 'in-handle' || role === 'out-handle') && pointId) {
    state.selectedPointId = pointId;
    state.dragState = {
      pointerId: event.pointerId,
      pointId,
      kind: role === 'in-handle' ? 'in-handle' : 'out-handle',
    };
    svg.setPointerCapture(event.pointerId);
    renderSvg();
    return;
  }

  const coordinates = getSvgCoordinates(event);
  const nextPoint = createPoint(coordinates.x, coordinates.y);
  state.points = [...state.points, nextPoint];
  state.selectedPointId = nextPoint.id;
  renderSvg();
}

function handlePointerMove(event: PointerEvent): void {
  if (!state.dragState || state.dragState.pointerId !== event.pointerId) return;
  const selected = state.points.find((point) => point.id === state.dragState?.pointId);
  if (!selected) return;

  const coordinates = getSvgCoordinates(event);
  if (state.dragState.kind === 'anchor') {
    updatePoint(selected.id, (point) => ({
      ...point,
      x: coordinates.x,
      y: coordinates.y,
    }));
    return;
  }

  const dx = coordinates.x - selected.x;
  const dy = coordinates.y - selected.y;
  const angle = normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI);
  const length = Math.sqrt(dx * dx + dy * dy);

  if (state.dragState.kind === 'in-handle') {
    updatePoint(selected.id, (point) => ({
      ...point,
      inAngle: angle,
      inLength: length,
      outAngle: point.linked ? normalizeAngle(angle + 180) : point.outAngle,
      outLength: point.linked ? length : point.outLength,
    }));
    return;
  }

  updatePoint(selected.id, (point) => ({
    ...point,
    outAngle: angle,
    outLength: length,
    inAngle: point.linked ? normalizeAngle(angle + 180) : point.inAngle,
    inLength: point.linked ? length : point.inLength,
  }));
}

function endDrag(pointerId: number): void {
  if (!state.dragState || state.dragState.pointerId !== pointerId) return;
  state.dragState = null;
  if (svg.hasPointerCapture(pointerId)) {
    svg.releasePointerCapture(pointerId);
  }
}

function selectedPointOrReturn(): CurvePoint | null {
  return getSelectedPoint();
}

function bindNumberInput(input: HTMLInputElement, key: 'x' | 'y' | 'inAngle' | 'inLength' | 'outAngle' | 'outLength'): void {
  input.addEventListener('input', () => {
    const selected = selectedPointOrReturn();
    if (!selected) return;
    const numeric = Number(input.value);
    if (!Number.isFinite(numeric)) return;

    updatePoint(selected.id, (point) => {
      if (key === 'x') return { ...point, x: clampToViewBox(numeric, VIEWBOX_WIDTH) };
      if (key === 'y') return { ...point, y: clampToViewBox(numeric, VIEWBOX_HEIGHT) };
      if (key === 'inAngle') {
        return {
          ...point,
          inAngle: normalizeAngle(numeric),
          outAngle: point.linked ? normalizeAngle(numeric + 180) : point.outAngle,
        };
      }
      if (key === 'outAngle') {
        return {
          ...point,
          outAngle: normalizeAngle(numeric),
          inAngle: point.linked ? normalizeAngle(numeric + 180) : point.inAngle,
        };
      }
      if (key === 'inLength') {
        const nextLength = Math.max(0, numeric);
        return {
          ...point,
          inLength: nextLength,
          outLength: point.linked ? nextLength : point.outLength,
        };
      }
      const nextLength = Math.max(0, numeric);
      return {
        ...point,
        outLength: nextLength,
        inLength: point.linked ? nextLength : point.inLength,
      };
    });
  });
}

function exportSvg(): void {
  const path = describePath(state.points);
  const markup = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}" fill="none">\n  <path d="${path}" fill="none" stroke="${PATH_STROKE}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>\n</svg>`;
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'closed-bezier-curve.svg';
  link.click();
  URL.revokeObjectURL(url);
}

svg.addEventListener('pointerdown', handlePointerDown);
svg.addEventListener('pointermove', handlePointerMove);
svg.addEventListener('pointerup', (event) => endDrag(event.pointerId));
svg.addEventListener('pointercancel', (event) => endDrag(event.pointerId));
svg.addEventListener('pointerleave', (event) => endDrag(event.pointerId));

bindNumberInput(anchorXInput, 'x');
bindNumberInput(anchorYInput, 'y');
bindNumberInput(inAngleInput, 'inAngle');
bindNumberInput(inLengthInput, 'inLength');
bindNumberInput(outAngleInput, 'outAngle');
bindNumberInput(outLengthInput, 'outLength');

linkedHandlesInput.addEventListener('change', () => {
  const selected = selectedPointOrReturn();
  if (!selected) return;
  updatePoint(selected.id, (point) => ({
    ...point,
    linked: linkedHandlesInput.checked,
    outAngle: linkedHandlesInput.checked ? normalizeAngle(point.inAngle + 180) : point.outAngle,
    outLength: linkedHandlesInput.checked ? point.inLength : point.outLength,
  }));
});

exportButton.addEventListener('click', exportSvg);

deleteSelectedButton.addEventListener('click', () => {
  const selected = selectedPointOrReturn();
  if (!selected) return;
  state.points = state.points.filter((point) => point.id !== selected.id);
  state.selectedPointId = state.points[0]?.id ?? null;
  renderSvg();
});

clearPointsButton.addEventListener('click', () => {
  state.points = [];
  state.selectedPointId = null;
  renderSvg();
});

renderSvg();
