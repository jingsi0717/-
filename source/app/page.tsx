'use client';
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CarFront,
  Check,
  ChevronDown,
  Clock3,
  CloudSun,
  Copy,
  Download,
  FileUp,
  Fuel,
  Gauge,
  Map,
  MapPin,
  NotebookPen,
  Pause,
  Play,
  Plus,
  Route,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { days, initialTodos, type TripDay } from '@/lib/trip-data';

type Tab = 'today' | 'trip' | 'todos' | 'journal';
type NodeStatus = 'pending' | 'current' | 'arrived' | 'completed' | 'skipped';
type Todo = {
  id: string;
  text: string;
  group: string;
  done: boolean;
  day?: number;
  node?: string;
  deadline?: string;
  note?: string;
  createdAt?: string;
  completedAt?: string;
  source?: 'preset' | 'manual' | 'decision';
};
type TripEvent = {
  id: string;
  day: number;
  at: string;
  kind: 'decision' | 'node' | 'todo' | 'state';
  text: string;
};
type Confirmation = {
  day: number;
  at: string;
  node: number;
  status: NodeStatus;
  decision: string;
  state: DayState;
  pickup: Saved['pickup'];
};
type Journal = {
  weather?: string;
  route?: string;
  food?: string;
  moment?: string;
  cost?: string;
  closing?: string;
  photos: string[];
};
type DayState = {
  time: string;
  eta: string;
  weather: string;
  road: string;
  energy: string;
  fuel: string;
  selected: number;
  note: string;
};
type Saved = {
  pickup: 'unknown' | 'early' | 'eight';
  statuses: Record<string, NodeStatus>;
  todos: Todo[];
  dayState: Record<number, DayState>;
  journal: Record<number, Journal>;
  confirmed?: Record<number, Confirmation>;
  events?: TripEvent[];
  manualDay?: number | null;
  finished?: boolean;
};
const makeDay = (): DayState => ({
  time: '',
  eta: '',
  weather: '晴朗',
  road: '顺畅',
  energy: '良好',
  fuel: '满箱',
  selected: 0,
  note: '',
});
const defaults: Saved = {
  pickup: 'unknown',
  statuses: {},
  todos: initialTodos,
  dayState: {},
  journal: {},
  confirmed: {},
  events: [],
  manualDay: null,
  finished: false,
};
function calendarDay(now = new Date()) {
  const date = Number(`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`);
  if (date < 20260927) return 1;
  if (date > 20261003) return 7;
  return date <= 20260930 ? date - 20260926 : date - 20261001 + 5;
}
function logEvent(day: number, kind: TripEvent['kind'], text: string): TripEvent {
  return { id: crypto.randomUUID(), day, at: new Date().toISOString(), kind, text };
}
const dayImages: Record<number, string> = {
  1: './images/danxia.jpg',
  2: './images/danxia.jpg',
  3: './images/mogao.jpg',
  4: './images/water-yadan.jpg',
  5: './images/emerald-lake.jpg',
  6: './images/chaka.jpg',
  7: './images/qinghai-lake.jpg',
};
const journalThemes: Record<number, { name: string; subtitle: string; motif: string; accent: string; pale: string }> = {
  1: { name: '启程前夜', subtitle: '把路交给明天', motif: '01 / ARRIVAL', accent: '#536774', pale: '#e7ecec' },
  2: { name: '丹霞向西', subtitle: '从张掖驶向敦煌', motif: '02 / WESTBOUND', accent: '#bb6240', pale: '#f3e7dc' },
  3: { name: '沙州一日', subtitle: '石窟与鸣沙山', motif: '03 / DUNHUANG', accent: '#a6753f', pale: '#f3eadb' },
  4: { name: '穿过荒原', subtitle: '向冷湖和雅丹去', motif: '04 / WILDERNESS', accent: '#5c6663', pale: '#e8e9e3' },
  5: { name: '沙路长歌', subtitle: '雅丹之后是 G315', motif: '05 / THE ROAD', accent: '#477c84', pale: '#e3eef0' },
  6: { name: '盐湖来信', subtitle: '从柴达木到茶卡', motif: '06 / SALT LAKE', accent: '#5c8b92', pale: '#e7f0ee' },
  7: { name: '暮湖辞行', subtitle: '望一眼青海湖，再回家', motif: '07 / HOMECOMING', accent: '#557b90', pale: '#e5edf1' },
};
const journalRouteStops: Record<number, string[]> = {
  1: ['张掖机场', '张掖市区'],
  2: ['张掖', '七彩丹霞', '瓜州', '敦煌'],
  3: ['敦煌', '莫高窟', '鸣沙山', '敦煌'],
  4: ['敦煌', '当金山', '黑独山', '冷湖', '水上雅丹'],
  5: ['水上雅丹', 'G315', '大柴旦'],
  6: ['大柴旦', '德令哈', '茶卡盐湖', '茶卡镇'],
  7: ['茶卡', '黑马河', '西宁机场'],
};
const statusText: Record<NodeStatus, string> = {
  pending: '未开始',
  current: '当前',
  arrived: '已到达',
  completed: '已完成',
  skipped: '已跳过',
};
function load(): Saved {
  if (typeof window === 'undefined') return defaults;
  try {
    const saved = JSON.parse(localStorage.getItem('qinggan-roadbook-v2') || '{}');
    const existingTodos: Todo[] = Array.isArray(saved.todos) ? saved.todos : [];
    const existingIds = new Set(existingTodos.map(todo => todo.id));
    return {
      ...defaults,
      ...saved,
      todos: [...existingTodos, ...initialTodos.filter(todo => !existingIds.has(todo.id))],
    };
  } catch {
    return defaults;
  }
}
function key(day: number, node: number) {
  return day + '-' + node;
}
function compress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image(),
      reader = new FileReader();
    reader.onload = () => {
      image.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(image.width, image.height)),
          canvas = document.createElement('canvas');
        canvas.width = image.width * scale;
        canvas.height = image.height * scale;
        canvas
          .getContext('2d')!
          .drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      image.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Roadbook() {
  const [tab, setTab] = useState<Tab>('today'),
    [day, setDay] = useState(1),
    [state, setState] = useState<Saved>(defaults),
    [ready, setReady] = useState(false),
    [mapPlaying, setMapPlaying] = useState(true),
    [openInfo, setOpenInfo] = useState('timeline'),
    [todoOpen, setTodoOpen] = useState(false),
    [todoFilter, setTodoFilter] = useState<'pre' | 'trip' | 'done'>('pre'),
    [draftStatus, setDraftStatus] = useState<NodeStatus>('pending'),
    [imageMode, setImageMode] = useState<'day' | 'all' | null>(null),
    [imageExport, setImageExport] = useState<{ busy: boolean; images: { day: number; src: string }[]; error?: string }>({ busy: false, images: [] }),
    [todoDraft, setTodoDraft] = useState({
      text: '',
      group: '行程',
      day: '2',
      deadline: '',
      note: '',
    });
  const decisionRef = useRef<HTMLElement>(null),
    importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (location.hostname === 'localhost') {
      navigator.serviceWorker
        ?.getRegistrations()
        .then((items) => items.forEach((item) => item.unregister()));
      caches
        ?.keys()
        .then((items) => items.forEach((item) => caches.delete(item)));
      if (new URLSearchParams(location.search).has('reset')) {
        localStorage.removeItem('qinggan-roadbook');
        localStorage.removeItem('qinggan-roadbook-v2');
        history.replaceState({}, '', location.pathname);
      }
    }
    const saved = load();
    const automaticDay = calendarDay();
    setState({ ...saved, finished: saved.finished || Date.now() > new Date(2026, 9, 3, 23, 59, 59).getTime() });
    setDay(saved.manualDay || automaticDay);
    setReady(true);
    if (location.hostname !== 'localhost' && 'serviceWorker' in navigator)
      navigator.serviceWorker
        .register('./sw.js', { updateViaCache: 'none' })
        .then((registration) => registration.update())
        .catch(() => {});
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem('qinggan-roadbook-v2', JSON.stringify(state));
      } catch {}
  }, [state, ready]);
  const d = days[day - 1],
    ds = state.dayState[day] || makeDay(),
    selected = Math.min(ds.selected, d.timeline.length - 1),
    node = d.timeline[selected],
    nodeStatus = state.statuses[key(day, selected)] || 'pending';
  useEffect(() => setDraftStatus(nodeStatus), [day, selected, nodeStatus]);
  const changeDay = (next: number) => { setDay(next); setState(s => ({ ...s, manualDay: next })); };
  const updateDay = (patch: Partial<DayState>) =>
    setState((s) => ({
      ...s,
      dayState: {
        ...s.dayState,
        [day]: { ...(s.dayState[day] || makeDay()), ...patch },
      },
    }));
  const selectNode = (index: number, returnToday = false) => {
    updateDay({ selected: index });
    if (returnToday) {
      setTab('today');
      setTimeout(
        () => decisionRef.current?.scrollIntoView({ behavior: 'smooth' }),
        50,
      );
    }
  };
  const setNodeStatus = (next: NodeStatus) =>
    setState((s) => {
      const statuses = { ...s.statuses };
      if (next === 'current')
        Object.keys(statuses)
          .filter((k) => k.startsWith(day + '-') && statuses[k] === 'current')
          .forEach((k) => (statuses[k] = 'pending'));
      statuses[key(day, selected)] = next;
      return { ...s, statuses, events: [...(s.events || []), logEvent(day, 'node', `${d.timeline[selected].title}：${statusText[next]}`)] };
    });
  const confirmDecision = () => setState(s => {
    const statuses = { ...s.statuses };
    if (draftStatus === 'current') Object.keys(statuses).filter(k => k.startsWith(day + '-') && statuses[k] === 'current').forEach(k => statuses[k] = 'pending');
    statuses[key(day, selected)] = draftStatus;
    const now = new Date().toISOString();
    const confirmation: Confirmation = { day, at: now, node: selected, status: draftStatus, decision: decision.title, state: { ...ds }, pickup: s.pickup };
    const added = [logEvent(day, 'decision', `确认：${decision.title}；${d.timeline[selected].title} ${statusText[draftStatus]}`)];
    if (ds.note.trim()) added.push(logEvent(day, 'state', `备注：${ds.note.trim()}`));
    const todos = s.todos.map(t => ({ ...t }));
    const decisionText = decision.title;
    const action = decision.level === 'danger' ? decisionText : day === 2 && decision.level === 'warn' ? '确认演出入场时间并直接前往敦煌' : day === 4 && decision.level === 'warn' ? '确认冷湖补给与水上雅丹景区外住宿' : day === 7 && decision.level === 'warn' ? '直接前往西宁机场' : '';
    if (action && !todos.some(t => t.source === 'decision' && t.day === day && t.text === action)) todos.push({ id: crypto.randomUUID(), text: action, group: '行程', day, done: false, source: 'decision', createdAt: now });
    if (/跳过黑独山|取消翡翠湖|取消全部停留/.test(decisionText)) {
      const target = decisionText.includes('黑独山') ? '黑独山' : decisionText.includes('翡翠湖') ? '翡翠湖' : '日月山';
      const index = d.timeline.findIndex(x => x.title.includes(target));
      if (index >= 0) statuses[key(day, index)] = 'skipped';
      added.push(logEvent(day, 'decision', `${target}已按建议跳过`));
    }
    const shouldAdvance = selected < d.timeline.length - 1;
    const nextSelected = shouldAdvance ? selected + 1 : selected;
    return {
      ...s,
      statuses,
      todos,
      dayState: { ...s.dayState, [day]: { ...(s.dayState[day] || makeDay()), selected: nextSelected, note: '' } },
      confirmed: { ...(s.confirmed || {}), [day]: confirmation },
      events: [...(s.events || []), ...added],
    };
  });
  const completed = d.timeline.filter(
    (_, i) => state.statuses[key(day, i)] === 'completed',
  ).length;
  const km = d.km.replace('约', '').replace(' km', '');
  const decision = useMemo(
    () => getDecision(day, ds, node.title, state.pickup),
    [day, ds, node.title, state.pickup],
  );
  const nextIndex = d.timeline.findIndex(
    (_, i) =>
      !['completed', 'skipped'].includes(
        state.statuses[key(day, i)] || 'pending',
      ),
  );
  const next = d.timeline[nextIndex < 0 ? d.timeline.length - 1 : nextIndex];
  const currentConfirmation = state.confirmed?.[day];
  const effectiveDecision = currentConfirmation?.decision;
  const dayEvents = (state.events || []).filter(x => x.day === day);
  const visibleTodos = state.todos.filter(t => todoFilter === 'done' ? t.done : !t.done && (todoFilter === 'pre' ? (!t.day || t.group === '出发前' || t.group === '预订') : !!t.day && t.group !== '出发前' && t.group !== '预订'));
  const todoGroups = todoFilter === 'trip'
    ? days.map(item => ({ id: `day-${item.id}`, label: `D${item.id} · ${item.date} · ${item.title}`, items: visibleTodos.filter(todo => todo.day === item.id) })).filter(group => group.items.length)
    : [{ id: todoFilter, label: todoFilter === 'done' ? '已完成记录' : '出发前准备', items: visibleTodos }];
  const exportJournalImages = (mode: 'day' | 'all') => {
    if (imageExport.busy) return;
    setImageExport({ busy: true, images: [] });
    setImageMode(mode);
  };
  useEffect(() => {
    if (!imageMode) return;
    let cancelled = false;
    const capture = async () => {
      const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
      const within = <T,>(promise: Promise<T>, ms: number, label: string) => Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), ms)),
      ]);
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (document.fonts?.ready) await Promise.race([document.fonts.ready.catch(() => undefined), wait(1500)]);
      const nodes = [...document.querySelectorAll<HTMLElement>('.image-export-document .journal-spread')];
      try {
        const images: { day: number; src: string }[] = [];
        for (const node of nodes) {
          await Promise.all([...node.querySelectorAll('img')].map(img => Promise.race([
            img.decode().catch(() => undefined),
            wait(1800),
          ])));
          const width = Math.ceil(Math.max(node.scrollWidth, node.offsetWidth));
          const height = Math.ceil(Math.max(node.scrollHeight, node.offsetHeight));
          const render = (pixelRatio: number, quality: number) => toJpeg(node, {
            quality,
            pixelRatio,
            width,
            height,
            style: { width: `${width}px`, height: `${height}px`, overflow: 'visible' },
            backgroundColor: '#f1e3ca',
            cacheBust: false,
          });
          let src: string;
          try {
            src = await within(render(1.15, .86), 15000, 'image render');
          } catch {
            // Retry once with a substantially smaller canvas for constrained WebViews.
            src = await within(render(.72, .78), 12000, 'fallback render');
          }
          images.push({ day: Number(node.dataset.day), src });
          await wait(80);
        }
        if (!cancelled) {
          images.forEach((item, index) => setTimeout(() => {
            const link = document.createElement('a');
            link.href = item.src;
            link.download = `2026青甘旅记-D${item.day}.jpg`;
            document.body.appendChild(link);
            link.click();
            link.remove();
          }, index * 220));
          setImageExport({ busy: false, images: [] });
          setImageMode(null);
        }
      } catch (error) {
        console.error('Journal image export failed', error);
        if (!cancelled) {
          setImageExport({ busy: false, images: [], error: '图片生成失败，请关闭其他页面后重试。' });
          setImageMode(null);
        }
      }
    };
    capture();
    return () => { cancelled = true; };
  }, [imageMode]);
  const saveTodo = () => {
    if (!todoDraft.text.trim()) return;
    setState((s) => ({
      ...s,
      events: [...(s.events || []), logEvent(Number(todoDraft.day) || day, 'todo', `新增待办：${todoDraft.text.trim()}`)],
      todos: [
        ...s.todos,
        {
          id: crypto.randomUUID(),
          text: todoDraft.text.trim(),
          group: todoDraft.group,
          done: false,
          day: Number(todoDraft.day),
          deadline: todoDraft.deadline,
          note: todoDraft.note,
          createdAt: new Date().toISOString(),
          source: 'manual',
        },
      ],
    }));
    setTodoOpen(false);
    setTodoDraft({
      text: '',
      group: '行程',
      day: String(day),
      deadline: '',
      note: '',
    });
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
        type: 'application/json',
      }),
      a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '青甘离线路书备份.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setState({ ...defaults, ...JSON.parse(await file.text()) });
    } catch {}
  };
  const setJournal = (id: number, patch: Partial<Journal>) =>
    setState((s) => ({
      ...s,
      journal: {
        ...s.journal,
        [id]: { ...(s.journal[id] || { photos: [] }), ...patch },
      },
    }));
  const addPhotos = async (id: number, files: FileList | null) => {
    if (!files) return;
    const current = state.journal[id] || { photos: [] };
    const photos = await Promise.all(
      [...files].slice(0, 12 - current.photos.length).map(compress),
    );
    setJournal(id, { photos: [...current.photos, ...photos] });
  };
  return (
    <main className="app">
      <header className="app-header">
        <button className="wordmark" onClick={() => setTab('today')}>
          <span>2026 · 青海 · 甘肃</span>
          <strong>自驾青甘</strong>
        </button>
        <span className="offline">
          <ShieldCheck />
          离线可用
        </span>
      </header>
      {imageMode && <section className="image-export-document" aria-hidden="true">{(imageMode === 'day' ? [d] : days).map(item => <JournalSpread key={item.id} d={item} journal={state.journal[item.id] || { photos: [] }} ds={state.dayState[item.id]} events={(state.events || []).filter(x => x.day === item.id)} statuses={state.statuses} todos={state.todos} />)}</section>}
      {tab === 'today' && (
        <section className="view">
          {state.finished && <div className="trip-finished"><strong>旅程已结束</strong><span>可以在旅记中回看和导出七天记录。</span><button onClick={() => setTab('journal')}>查看旅记</button></div>}
          <div className="view-title">
            <div>
              <span>
                D{day} · {d.date}
              </span>
              <h1>{d.title}</h1>
            </div>
            <select
              aria-label="切换当前日期"
              value={day}
              onChange={(e) => changeDay(Number(e.target.value))}
            >
              {days.map((x) => (
                <option key={x.id} value={x.id}>
                  D{x.id} {x.date}
                </option>
              ))}
            </select>
          </div>
          <div className="metrics">
            <div>
              <b>{completed}/{d.timeline.length}</b>
              <span>完成节点</span>
            </div>
            <div>
              <b>
                {
                  state.todos.filter(
                    (x) => !x.done && (x.day === day || !x.day),
                  ).length
                }
              </b>
              <span>待办</span>
            </div>
            <div>
              <b>{km}</b>
              <span>当日里程</span>
            </div>
          </div>
          <SectionTitle
            title="当天进度"
            detail={completed + '/' + d.timeline.length}
          />
          <div className="progress-scroll">
            {d.timeline.map((x, i) => {
              const s = state.statuses[key(day, i)] || 'pending';
              return (
                <button
                  key={i}
                  className={'progress-node ' + s}
                  onClick={() => selectNode(i, true)}
                >
                  <i>{s === 'completed' ? <Check /> : i + 1}</i>
                  <span>{x.time}</span>
                  <b>{x.title}</b>
                  <em>{statusText[s]}</em>
                </button>
              );
            })}
          </div>
          <SectionTitle title="下一步行动" />
          <article className="next-action">
            <div className="next-action-content">
              <img src={dayImages[day]} alt={`${d.title}沿途风景`} />
              <div>
                <span>{next.time}</span>
                <h2>{next.title}</h2>
                <p>{next.note || d.summary}</p>
              </div>
            </div>
            <div className="action-buttons">
              <button
                onClick={() => selectNode(nextIndex < 0 ? d.timeline.length - 1 : nextIndex, true)}
              >
                <Play />
                去决策中心
              </button>
              <button
                onClick={() => navigator.clipboard?.writeText(next.title)}
              >
                <Copy />
                复制目的地
              </button>
            </div>
          </article>
          <DecisionCenter
            ref={decisionRef}
            day={day}
            d={d}
            ds={ds}
            updateDay={updateDay}
            selected={selected}
            setSelected={selectNode}
            status={nodeStatus}
            setStatus={setNodeStatus}
            draftStatus={draftStatus}
            setDraftStatus={setDraftStatus}
            onConfirm={confirmDecision}
            confirmedAt={currentConfirmation?.at}
            decision={decision}
            pickup={state.pickup}
            setPickup={(pickup) => setState((s) => ({ ...s, pickup }))}
          />
        </section>
      )}
      {tab === 'trip' && (
        <section className="view">
          <div className="view-title">
            <div>
              <span>完整行程</span>
              <h1>
                D{day} · {d.title}
              </h1>
            </div>
          </div>
          <div className="date-strip">
            {days.map((x) => (
              <button
                key={x.id}
                className={day === x.id ? 'active' : ''}
                onClick={() => changeDay(x.id)}
              >
                D{x.id}
                <small>{x.date.split(' ')[0]}</small>
              </button>
            ))}
          </div>
          <TripMap
            day={day}
            playing={mapPlaying}
            setPlaying={setMapPlaying}
            statuses={state.statuses}
            onNode={(i) => selectNode(i, true)}
          />
          <article className="overview">
            <header>
              <div>
                <span>
                  {d.km} · {d.drive}
                </span>
                <h2>当日概览</h2>
              </div>
              <b>{d.stay}</b>
            </header>
            <div className="overview-list">
              {d.timeline.map((x, i) => {
                const s = state.statuses[key(day, i)] || 'pending';
                return (
                  <button key={i} onClick={() => selectNode(i, true)}>
                    <i className={s} />
                    <time>{x.time}</time>
                    <span>{x.title}</span>
                    <em>{statusText[s]}</em>
                  </button>
                );
              })}
            </div>
          </article>
          <InfoAccordion d={d} ds={ds} decision={effectiveDecision} statuses={state.statuses} open={openInfo} setOpen={setOpenInfo} />
        </section>
      )}
      {tab === 'todos' && (
        <section className="view">
          <div className="view-title">
            <div>
              <span>{state.todos.filter((x) => !x.done).length}项未完成</span>
              <h1>待办事项</h1>
            </div>
            <button
              className="orange-button"
              onClick={() => {
                setTodoDraft((x) => ({ ...x, day: String(day) }));
                setTodoOpen(true);
              }}
            >
              <Plus />
              新增
            </button>
          </div>
          <div className="todo-filters">
            <button className={todoFilter === 'pre' ? 'active' : ''} onClick={() => setTodoFilter('pre')}>出发前</button>
            <button className={todoFilter === 'trip' ? 'active' : ''} onClick={() => setTodoFilter('trip')}>行程中</button>
            <button className={todoFilter === 'done' ? 'active' : ''} onClick={() => setTodoFilter('done')}>已完成（{state.todos.filter(x => x.done).length}）</button>
          </div>
          <div className="todo-list">
            {todoGroups.map(group => <section className="todo-day-group" key={group.id}><h2>{group.label}<small>{group.items.length}项</small></h2>{group.items.map((t) => (
              <label
                key={t.id}
                className={'todo-row ' + (t.done ? 'done' : '')}
              >
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() =>
                    setState((s) => ({
                      ...s,
                      todos: s.todos.map((x) => x.id === t.id ? { ...x, done: !x.done, completedAt: !x.done ? new Date().toISOString() : undefined } : x),
                      events: [...(s.events || []), logEvent(t.day || day, 'todo', `${t.done ? '恢复' : '完成'}待办：${t.text}`)],
                    }))
                  }
                />
                <span>
                  <b>{t.text}</b>
                  <small>
                    {t.group}
                    {t.day ? ' · D' + t.day : ''}
                    {t.deadline ? ' · ' + t.deadline : ''}
                  </small>
                </span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setState((s) => ({
                      ...s,
                      todos: s.todos.filter((x) => x.id !== t.id),
                      events: [...(s.events || []), logEvent(t.day || day, 'todo', `删除待办：${t.text}`)],
                    }));
                  }}
                >
                  <Trash2 />
                </button>
              </label>
            ))}</section>)}
          </div>
          {todoOpen && (
            <TodoSheet
              draft={todoDraft}
              setDraft={setTodoDraft}
              save={saveTodo}
              close={() => setTodoOpen(false)}
            />
          )}
        </section>
      )}
      {tab === 'journal' && (
        <section className="view">
          <div className="view-title">
            <div>
              <span>
                D{day} · {d.date}
              </span>
              <h1>{d.title}</h1>
            </div>
            <select
              aria-label="切换旅记日期"
              value={day}
              onChange={(e) => changeDay(Number(e.target.value))}
            >
              {days.map((x) => (
                <option key={x.id} value={x.id}>
                  D{x.id}
                </option>
              ))}
            </select>
          </div>
          <JournalPage
            d={d}
            journal={state.journal[day] || { photos: [] }}
            setJournal={(patch) => setJournal(day, patch)}
            addPhotos={(files) => addPhotos(day, files)}
          />
          <h2 className="journal-preview-heading">当日手帐预览 <span>内容和照片会随记录更新</span></h2>
          <div className="journal-preview"><JournalSpread d={d} journal={state.journal[day] || { photos: [] }} ds={state.dayState[day]} events={dayEvents} statuses={state.statuses} todos={state.todos} /></div>
          <SystemJournal d={d} events={dayEvents} ds={ds} hasState={Boolean(state.dayState[day])} statuses={state.statuses} todos={state.todos} />
          <div className="journal-actions"><button disabled={imageExport.busy} onClick={() => exportJournalImages('day')}><Download />{imageExport.busy ? '正在生成…' : '下载当天图片'}</button><button disabled={imageExport.busy} onClick={() => exportJournalImages('all')}><Download />{imageExport.busy ? '正在生成…' : '下载七日图片'}</button></div>
          {imageExport.error && <p className="journal-export-message" role="alert">{imageExport.error}</p>}
          <article className="backup"><h3>本机数据备份</h3><p>旅记图片用于阅读留存；JSON 用于换机恢复，包含照片。清除微信数据前请先备份。</p><div><button onClick={exportData}><Download />导出 JSON 备份</button><button onClick={() => importRef.current?.click()}><FileUp />导入 JSON 备份</button><input ref={importRef} hidden type="file" accept=".json" onChange={importData} /></div></article>
        </section>
      )}
      <nav className="bottom-nav">
        {(
          [
            ['today', Map, '今日'],
            ['trip', Route, '行程'],
            ['todos', Check, '待办'],
            ['journal', NotebookPen, '旅记'],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            onClick={() => {
              setTab(id);
              scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {detail && <span>{detail}</span>}
    </div>
  );
}
function getDecision(day: number, ds: DayState, node: string, pickup: string) {
  if (ds.energy === '必须休息')
    return {
      level: 'danger',
      title: '先停车休息',
      text: '体力状态不适合继续驾驶，暂缓所有景点。',
    };
  if (ds.fuel === '¼箱以下')
    return {
      level: 'danger',
      title: '先寻找可靠加油站',
      text: '不要进入下一段荒漠或长距离路段。',
    };
  if (day === 2) {
    if (pickup === 'eight' || ds.eta >= '19:00')
      return {
        level: 'warn',
        title: '演出优先，现在离开',
        text: '丹霞降级，不压缩休息，也不通过超速追回时间。',
      };
    return {
      level: 'good',
      title: '可保留丹霞短游',
      text: '建议10:30离开，12:00为最晚截止。',
    };
  }
  if (day === 4 && ['大风', '沙尘', '雨雪', '能见度差'].includes(ds.weather))
    return {
      level: 'warn',
      title: '跳过黑独山',
      text: '直接前往冷湖补给，并确保天黑前抵达景区外住宿。',
    };
  if (day === 5 && (ds.time >= '16:30' || ds.energy === '疲劳'))
    return {
      level: 'warn',
      title: '取消翡翠湖',
      text: '加油、检查车辆并早点休息。',
    };
  if (day === 7 && ds.eta >= '16:30')
    return {
      level: 'danger',
      title: '取消全部停留，直接去机场',
      text: '航班优先，不再加入日月山。',
    };
  return {
    level: 'good',
    title: '按当前计划继续',
    text: '状态允许执行“' + node + '”，完成后再更新下一节点。',
  };
}
function DecisionCenterImpl(
  {
    day,
    d,
    ds,
    updateDay,
    selected,
    setSelected,
    status,
    setStatus,
    draftStatus,
    setDraftStatus,
    onConfirm,
    confirmedAt,
    decision,
    pickup,
    setPickup,
  }: {
    day: number;
    d: TripDay;
    ds: DayState;
    updateDay: (x: Partial<DayState>) => void;
    selected: number;
    setSelected: (i: number) => void;
    status: NodeStatus;
    setStatus: (x: NodeStatus) => void;
    draftStatus: NodeStatus;
    setDraftStatus: (x: NodeStatus) => void;
    onConfirm: () => void;
    confirmedAt?: string;
    decision: { level: string; title: string; text: string };
    pickup: string;
    setPickup: (x: 'unknown' | 'early' | 'eight') => void;
  },
  ref: React.ForwardedRef<HTMLElement>,
) {
  return (
    <section className="decision-center" ref={ref}>
      <h2 className="decision-center-title">当天决策中心</h2>
      <header>
        <AlertTriangle />
        <div>
          <span>当前节点</span>
          <h2>{d.timeline[selected].title}</h2>
        </div>
        <select
          value={selected}
          onChange={(e) => setSelected(Number(e.target.value))}
        >
          {d.timeline.map((x, i) => (
            <option key={i} value={i}>
              {x.title}
            </option>
          ))}
        </select>
      </header>
      {day === 2 && (
        <div className="pickup-row">
          <button
            className={pickup === 'unknown' ? 'active' : ''}
            onClick={() => setPickup('unknown')}
          >
            待确认
          </button>
          <button
            className={pickup === 'early' ? 'active' : ''}
            onClick={() => setPickup('early')}
          >
            可提前取车
          </button>
          <button
            className={pickup === 'eight' ? 'active' : ''}
            onClick={() => setPickup('eight')}
          >
            只能08:00
          </button>
        </div>
      )}
      <div className="state-fields">
        <label>
          <Clock3 />
          <span>当前时间</span>
          <input
            type="time"
            value={ds.time}
            onChange={(e) => updateDay({ time: e.target.value })}
          />
        </label>
        <label>
          <MapPin />
          <span>预计到达</span>
          <input
            type="time"
            value={ds.eta}
            onChange={(e) => updateDay({ eta: e.target.value })}
          />
        </label>
        <Choice
          icon={<CloudSun />}
          label="天气"
          value={ds.weather}
          options={['晴朗', '阴天', '大风', '沙尘', '雨雪', '能见度差']}
          onChange={(weather) => updateDay({ weather })}
        />
        <Choice
          icon={<Route />}
          label="路况"
          value={ds.road}
          options={[
            '顺畅',
            '轻微拥堵',
            '明显拥堵',
            '临时管制',
            '路面结冰',
            '未知',
          ]}
          onChange={(road) => updateDay({ road })}
        />
        <Choice
          icon={<Gauge />}
          label="体力"
          value={ds.energy}
          options={['良好', '一般', '疲劳', '必须休息']}
          onChange={(energy) => updateDay({ energy })}
        />
        <Choice
          icon={<Fuel />}
          label="油量"
          value={ds.fuel}
          options={['满箱', '¾箱', '半箱', '¼箱以下']}
          onChange={(fuel) => updateDay({ fuel })}
        />
      </div>
      <div className={'decision-result ' + decision.level}>
        <span>行程建议</span>
        <h3>{decision.title}</h3>
        <p>{decision.text}</p>
      </div>
      <h3 className="subhead">更新当前节点</h3>
      <div className="status-actions">
        {(
          [
            'current',
            'arrived',
            'completed',
            'skipped',
            'pending',
          ] as NodeStatus[]
        ).map((x) => (
          <button
            key={x}
            className={draftStatus === x ? 'active' : ''}
            onClick={() => setDraftStatus(x)}
          >
            {x === 'pending' && status === 'skipped' ? '恢复' : statusText[x]}
          </button>
        ))}
      </div>
      <label className="note-field">
        <span>临时备注</span>
        <textarea
          value={ds.note}
          onChange={(e) => updateDay({ note: e.target.value })}
          placeholder="路况变化、实际停留或临时决定…"
        />
      </label>
      <button className="confirm" onClick={onConfirm}>
        <Check />
        确认并同步
      </button>
      {confirmedAt && <p className="sync-note">最近提交：{new Date(confirmedAt).toLocaleString('zh-CN')} · 可从上方节点选择器返回并更新记录</p>}
    </section>
  );
}
const DecisionCenter = React.forwardRef(DecisionCenterImpl);
function Choice({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label>
      {icon}
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </label>
  );
}

function TripMap({
  day,
  playing,
  setPlaying,
  statuses,
  onNode,
}: {
  day: number;
  playing: boolean;
  setPlaying: (x: boolean) => void;
  statuses: Record<string, NodeStatus>;
  onNode: (i: number) => void;
}) {
  const d = days[day - 1];
  const routeLayouts: Record<number, { path: string; points: [number, number][] }> = {
    1: { path: 'M505 90 L520 96 L512 105', points: [[505, 90], [520, 96], [512, 105]] },
    2: { path: 'M505 90 L475 88 C400 70 295 65 182 74', points: [[505, 90], [493, 88], [475, 88], [310, 66], [190, 73], [182, 74]] },
    3: { path: 'M182 74 L192 80 L184 88 L178 94', points: [[182, 74], [192, 80], [184, 88], [178, 94]] },
    4: { path: 'M182 74 C158 102 135 126 118 151 S95 201 91 222', points: [[182, 74], [146, 116], [118, 151], [103, 176], [91, 222]] },
    5: { path: 'M91 222 C126 219 162 205 195 189 S229 173 246 168', points: [[91, 222], [145, 212], [225, 176], [246, 168]] },
    6: { path: 'M246 168 C320 177 370 207 423 226', points: [[246, 168], [338, 188], [423, 226], [438, 232]] },
    7: { path: 'M438 232 C468 236 500 234 529 222 S570 216 602 222', points: [[438, 232], [473, 237], [529, 222], [588, 218], [602, 222]] },
  };
  const fullRoute = 'M505 90 C400 70 295 65 182 74 C158 102 135 126 118 151 S95 201 91 222 C126 219 162 205 246 168 C320 177 370 207 438 232 C468 236 500 234 529 222 S570 216 602 222';
  const layout = routeLayouts[day];
  return (
    <article className="trip-map">
      <img src="./route-map-clean-v2.png" alt="甘肃青海真实地理关系离线地图" />
      <svg
        viewBox="0 0 680 330"
        preserveAspectRatio="none"
        aria-label="全程路线与当日高亮路线"
      >
        <path
          className="route-all"
          d={fullRoute}
        />
        <path
          className={'route-day d' + day}
          d={layout.path}
        />
        {d.timeline.map((x, i) => {
          const [px, py] = layout.points[i] || layout.points[layout.points.length - 1],
            s = statuses[key(day, i)] || 'pending';
          return (
            <g key={i} className={'map-point ' + s} onClick={() => onNode(i)}>
              <circle cx={px} cy={py} r="8" />
              <text x={px} y={py - 15} textAnchor="middle">
                {short(x.title)}
              </text>
            </g>
          );
        })}
        <g
          className="map-car"
          transform={playing ? undefined : `translate(${layout.points[0][0]} ${layout.points[0][1]})`}
        >
          {playing && (
            <animateMotion dur="8s" repeatCount="indefinite" path={layout.path} />
          )}
          <circle r="13" />
          <CarFront x="-8" y="-8" width="16" height="16" />
        </g>
      </svg>
      <div className="map-controls">
        <button
          onClick={() => setPlaying(true)}
          className={playing ? 'active' : ''}
        >
          <Play />
          播放
        </button>
        <button onClick={() => setPlaying(false)}>
          <Pause />
          暂停
        </button>
      </div>
      <span className="map-disclaimer">
        全程路线常驻 · D{day}路线高亮 · 示意不用于导航
      </span>
    </article>
  );
}
function short(s: string) {
  return s
    .replace('务必离开', '')
    .replace('吃饭、加油、补水', '补给')
    .slice(0, 7);
}
function InfoAccordion({
  d,
  ds,
  decision,
  statuses,
  open,
  setOpen,
}: {
  d: TripDay;
  ds: DayState;
  decision?: string;
  statuses: Record<string, NodeStatus>;
  open: string;
  setOpen: (x: string) => void;
}) {
  const items = [
    ['timeline', '时间、里程、住宿', d.summary + ' 住宿：' + d.stay + (ds.eta ? `；手动预计到达 ${ds.eta}` : '')],
    [
      'priority',
      '优先级与可砍项目',
      '优先级：' + d.priorities.join(' ＞ ') + '。可砍：' + d.cuts.join('；') + '。已跳过：' + (d.timeline.filter((_, i) => statuses[key(d.id, i)] === 'skipped').map(x => x.title).join('、') || '无'),
    ],
    ['fuel', '吃饭、加油与休息', d.fuel.join('；') + `。当前油量：${ds.fuel}；体力：${ds.energy}。每1.5—2小时休息。`],
    ['risk', '风险提醒与当天决策', (decision ? `已确认：${decision}。` : '') + (d.decision || '不赶夜路，安全抵达优先。') + ` 手动天气：${ds.weather}；路况：${ds.road}。`],
  ];
  return (
    <div className="info-accordion">
      {items.map(([id, title, text]) => (
        <article key={id}>
          <button onClick={() => setOpen(open === id ? '' : id)}>
            <span>{title}</span>
            <ChevronDown className={open === id ? 'open' : ''} />
          </button>
          {open === id && <p>{text}</p>}
        </article>
      ))}
    </div>
  );
}
function TodoSheet({
  draft,
  setDraft,
  save,
  close,
}: {
  draft: any;
  setDraft: (x: any) => void;
  save: () => void;
  close: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={close}>
      <form className="todo-sheet" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <header>
          <h2>新增待办</h2>
          <button type="button" onClick={close}>
            <X />
          </button>
        </header>
        <label>
          标题
          <input
            autoFocus
            required
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            placeholder="例如：检查备用轮胎"
          />
        </label>
        <div className="form-pair">
          <label>
            分类
            <select
              value={draft.group}
              onChange={(e) => setDraft({ ...draft, group: e.target.value })}
            >
              {['出发前', '预订', '住宿', '车辆', '补给', '安全', '行程'].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </label>
          <label>
            关联日期
            <select
              value={draft.day}
              onChange={(e) => setDraft({ ...draft, day: e.target.value })}
            >
              {days.map((x) => (
                <option key={x.id} value={x.id}>
                  D{x.id} {x.date}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          截止时间
          <input
            type="time"
            value={draft.deadline}
            onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
          />
        </label>
        <label>
          备注
          <textarea
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </label>
        <footer>
          <button type="button" onClick={close}>取消</button>
          <button type="submit" className="save" disabled={!draft.text.trim()}>
            保存
          </button>
        </footer>
      </form>
    </div>
  );
}
function JournalPage({
  d,
  journal,
  setJournal,
  addPhotos,
}: {
  d: TripDay;
  journal: Journal;
  setJournal: (x: Partial<Journal>) => void;
  addPhotos: (x: FileList | null) => void;
}) {
  const fields: [keyof Journal, string, string][] = [
    ['weather', '天气与起居', '几点起床，天气如何，怎么开始这一天？'],
    ['route', '今日所行', '去了哪里，路上看见了什么？'],
    ['food', '吃了什么', '在哪里吃，味道如何？'],
    ['moment', '今日一事', '只记一件最值得留下的事。'],
    ['cost', '实际里程与花费', '实际里程、油费、餐费、门票。'],
    ['closing', '一句收尾', '用一句话结束今天。'],
  ];
  return (
    <>
      <article className="journal-paper">
        <h2>
          {d.date.split(' ')[0]}，{d.title}
        </h2>
        {fields.map(([field, label, placeholder]) => (
          <label key={field}>
            <span>{label}</span>
            <textarea
              value={(journal[field] as string) || ''}
              onChange={(e) => setJournal({ [field]: e.target.value })}
              placeholder={placeholder}
            />
          </label>
        ))}
      </article>
      <article className="photo-section">
        <header>
          <h3>照片 {journal.photos.length} / 12</h3>
          <label>
            <Camera />
            添加照片
            <input
              hidden
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addPhotos(e.target.files)}
            />
          </label>
        </header>
        <div className="photos">
          {journal.photos.map((photo, i) => (
            <figure key={i}>
              <img src={photo} alt={'旅记照片' + (i + 1)} />
              <button
                onClick={() =>
                  setJournal({
                    photos: journal.photos.filter((_, n) => n !== i),
                  })
                }
              >
                <X />
              </button>
            </figure>
          ))}
        </div>
      </article>
    </>
  );
}
function SystemJournal({ d, events, ds, hasState, statuses, todos }: { d: TripDay; events: TripEvent[]; ds: DayState; hasState: boolean; statuses: Record<string, NodeStatus>; todos: Todo[] }) {
  const completedNodes = d.timeline.filter((_, i) => statuses[key(d.id, i)] === 'completed').map(x => x.title);
  const skippedNodes = d.timeline.filter((_, i) => statuses[key(d.id, i)] === 'skipped').map(x => x.title);
  const dayTodos = todos.filter(x => x.day === d.id && x.done);
  return <article className="system-journal"><h2>系统行程记录</h2><p>计划：{d.title} · {d.km} · 住宿 {d.stay}</p><p>{hasState ? <>手动状态：天气 {ds.weather}，路况 {ds.road}，体力 {ds.energy}，油量 {ds.fuel}{ds.eta ? `，预计到达 ${ds.eta}` : ''}</> : '当天状态尚未记录。'}</p>{completedNodes.length > 0 && <p>已完成：{completedNodes.join('、')}</p>}{skippedNodes.length > 0 && <p>已跳过：{skippedNodes.join('、')}</p>}{dayTodos.length > 0 && <p>完成待办：{dayTodos.map(x => x.text).join('、')}</p>}{events.length === 0 ? <p>当天尚无操作记录。</p> : <ol>{events.map(x => <li key={x.id}><time>{new Date(x.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time> {x.text}</li>)}</ol>}</article>;
}
function JournalSpread({ d, journal, ds, events, statuses, todos }: { d: TripDay; journal: Journal; ds?: DayState; events: TripEvent[]; statuses: Record<string, NodeStatus>; todos: Todo[] }) {
  const theme = journalThemes[d.id];
  const stops = journalRouteStops[d.id];
  const recorded = (value?: string) => value?.trim() || '待记录';
  const doneTodos = todos.filter(x => x.day === d.id && x.done);
  const actualPhotos = journal.photos.slice(0, 4);
  const scenicPhotos = actualPhotos.slice(2);
  const referencePhoto = d.id === 1 ? undefined : dayImages[d.id];
  const routeX = stops.map((_, i) => 35 + (i * 430) / Math.max(1, stops.length - 1));
  const routePhoto = d.id === 5 ? './images/water-yadan.jpg' : dayImages[d.id];
  const routeBackdrop = d.id === 1 || d.id === 4
    ? { backgroundImage: `linear-gradient(#f6edddd4,#f6edddd4),url('./images/journal-vignettes.jpg')`, backgroundSize: 'auto,700% 100%', backgroundPosition: `center,${(d.id - 1) * 100 / 6}% center` }
    : { backgroundImage: `linear-gradient(#f6edddd4,#f6edddd4),url('${routePhoto}')`, backgroundSize: 'auto,cover', backgroundPosition: 'center' };
  return <article className="journal-spread" data-day={d.id} style={{ '--journal-accent': theme.accent, '--journal-pale': theme.pale } as React.CSSProperties}>
    <div className="spread-grid">
      <section className="spread-left">
        <header className="spread-header"><span className="spread-day">D{d.id}</span><div><h2>{theme.name}</h2><p>{theme.subtitle}</p></div><time>2026 · {d.date}</time></header>
        <div className="spread-topcards">
          <section className="scrap-card weather-card"><h3>天气与路况</h3><p>{ds ? `${ds.weather} · ${ds.road}` : '待当天记录'}</p><small>{recorded(journal.weather)}</small></section>
          <section className="scrap-card story-card"><h3>今日记事</h3><p>{recorded(journal.route)}</p></section>
          <section className="scrap-card mileage-card"><h3>里程记录</h3><p>{recorded(journal.cost)}</p><small>计划 {d.km} · 驾驶 {d.drive}</small></section>
        </div>
        <div className="spread-actual">
          <section className="actual-timeline"><h3>实际行程 <small>TRAVEL LOG</small></h3><ol>{d.timeline.map((node, i) => {
            const status = statuses[key(d.id, i)] || 'pending';
            const event = status !== 'pending' ? [...events].reverse().find(x => (x.kind === 'node' || x.kind === 'decision') && x.text.includes(node.title)) : undefined;
            const actualTime = event ? new Date(event.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : undefined;
            return <li key={i} className={status}><span className="time-dot"/><time>{actualTime || node.time}</time><div><strong>{node.title}</strong><small>{actualTime ? statusText[status] : `计划 · ${statusText[status]}`}</small></div></li>;
          })}</ol></section>
          <div className="actual-polaroids">{[0, 1].map(i => <figure key={i} className={`polaroid polaroid-${i + 1}`}><span className="photo-tape" aria-hidden="true"/>{actualPhotos[i] ? <img src={actualPhotos[i]} alt={`当天实拍照片 ${i + 1}`} /> : <div className="photo-placeholder"><Camera/><span>添加实拍照片</span></div>}<figcaption>{actualPhotos[i] ? `这一天 · ${i + 1}` : '等一张路上的照片'}</figcaption></figure>)}</div>
        </div>
        <footer className="left-footnote">{doneTodos.length ? `已完成：${doneTodos.map(x => x.text).join('、')}` : '完成的待办会留在这里。'}</footer>
      </section>
      <section className="spread-right">
        <div className="route-sketch" style={routeBackdrop}><span className="paper-clip" aria-hidden="true"/><h3>计划路线</h3><svg viewBox="0 0 500 140" role="img" aria-label={`${stops.join('至')}的计划路线示意图`}><path d="M35 74 C130 28 190 110 270 70 S390 50 465 72" className="sketch-route"/>{stops.map((stop, i) => <g key={`${stop}-${i}`} transform={`translate(${routeX[i]} ${i % 2 ? 67 : 74})`}><circle r="6"/><text y={i % 2 ? -15 : 23} textAnchor="middle">{stop}</text></g>)}</svg></div>
        <div className="scenic-heading">沿途照片 <small>{scenicPhotos.length ? '实拍记录' : '参考影像 · 可用实拍替换'}</small></div>
        <div className="scenic-photos">{[0, 1].map(i => <figure key={i} className={`scenic-photo scenic-${i + 1}`}><span className="photo-tape" aria-hidden="true"/>{scenicPhotos[i] ? <img src={scenicPhotos[i]} alt={`沿途实拍照片 ${i + 1}`} /> : i === 0 && referencePhoto ? <img src={referencePhoto} alt={`${d.title}参考风景`} /> : <div className="photo-placeholder"><Camera/><span>留给沿途风景</span></div>}<figcaption>{scenicPhotos[i] ? `沿途 · ${i + 1}` : i === 0 && referencePhoto ? '行前参考，待实拍替换' : '待添加照片'}</figcaption></figure>)}</div>
        <div className="spread-note-grid"><section className="scrap-card note-card"><h3>个人随笔</h3><p>{recorded(journal.moment)}</p></section><section className="scrap-card food-card"><h3>今日美食</h3><p>{recorded(journal.food)}</p></section></div>
        <div className="spread-quote"><div><h3>一句收尾</h3><p>{recorded(journal.closing)}</p></div><div className="day-vignette" style={{ backgroundPosition: `${(d.id - 1) * 100 / 6}% center` }} role="img" aria-label={`${theme.name}水彩景点插画`} /></div>
        <footer className="spread-footer"><span>{theme.motif}</span><span>{events.length ? `${events.length} 条操作记录` : '待记录'} · {d.stay}</span></footer>
      </section>
    </div>
  </article>;
}
