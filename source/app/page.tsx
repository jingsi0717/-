'use client';
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  statuses: { '2-0': 'completed', '2-1': 'current' },
  todos: initialTodos,
  dayState: {},
  journal: {},
};
const dayImages: Record<number, string> = {
  1: './images/danxia.jpg',
  2: './images/danxia.jpg',
  3: './images/mogao.jpg',
  4: './images/water-yadan.jpg',
  5: './images/emerald-lake.jpg',
  6: './images/chaka.jpg',
  7: './images/qinghai-lake.jpg',
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
    return {
      ...defaults,
      ...JSON.parse(localStorage.getItem('qinggan-roadbook-v2') || '{}'),
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
    [day, setDay] = useState(2),
    [state, setState] = useState<Saved>(defaults),
    [ready, setReady] = useState(false),
    [mapPlaying, setMapPlaying] = useState(true),
    [openInfo, setOpenInfo] = useState('timeline'),
    [todoOpen, setTodoOpen] = useState(false),
    [todoDraft, setTodoDraft] = useState({
      text: '',
      group: '行程',
      day: '2',
      node: '',
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
    setState(load());
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
      return { ...s, statuses };
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
  const saveTodo = () => {
    if (!todoDraft.text.trim()) return;
    setState((s) => ({
      ...s,
      todos: [
        ...s.todos,
        {
          id: crypto.randomUUID(),
          text: todoDraft.text.trim(),
          group: todoDraft.group,
          done: false,
          day: Number(todoDraft.day),
          node: todoDraft.node,
          deadline: todoDraft.deadline,
          note: todoDraft.note,
        },
      ],
    }));
    setTodoOpen(false);
    setTodoDraft({
      text: '',
      group: '行程',
      day: String(day),
      node: '',
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
        [id]: { photos: [], ...(s.journal[id] || {}), ...patch },
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
      {tab === 'today' && (
        <section className="view">
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
              onChange={(e) => setDay(Number(e.target.value))}
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
              <b>{d.timeline.length}</b>
              <span>当日节点</span>
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
                onClick={() => {
                  selectNode(
                    nextIndex < 0 ? d.timeline.length - 1 : nextIndex,
                    true,
                  );
                  setNodeStatus('current');
                }}
              >
                <Play />
                开始此路段
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
                onClick={() => setDay(x.id)}
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
          <InfoAccordion d={d} open={openInfo} setOpen={setOpenInfo} />
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
            <button className="active">全部</button>
            <button>出发前</button>
            <button>行程中</button>
            <button>已完成</button>
          </div>
          <div className="todo-list">
            {state.todos.map((t) => (
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
                      todos: s.todos.map((x) =>
                        x.id === t.id ? { ...x, done: !x.done } : x,
                      ),
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
                    }));
                  }}
                >
                  <Trash2 />
                </button>
              </label>
            ))}
          </div>
          <article className="backup">
            <h3>本机数据</h3>
            <p>导出或恢复行程状态、待办和旅记。照片会使备份文件变大。</p>
            <div>
              <button onClick={exportData}>
                <Download />
                导出备份
              </button>
              <button onClick={() => importRef.current?.click()}>
                <FileUp />
                恢复备份
              </button>
              <input
                ref={importRef}
                hidden
                type="file"
                accept=".json"
                onChange={importData}
              />
            </div>
          </article>
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
              onChange={(e) => setDay(Number(e.target.value))}
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
            className={status === x ? 'active' : ''}
            onClick={() => setStatus(x)}
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
      <button className="confirm">
        <Check />
        确认并同步
      </button>
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
        <button>
          <Map />
          图例
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
  open,
  setOpen,
}: {
  d: TripDay;
  open: string;
  setOpen: (x: string) => void;
}) {
  const items = [
    ['timeline', '时间、里程、住宿', d.summary + ' 住宿：' + d.stay],
    [
      'priority',
      '优先级与可砍项目',
      '优先级：' + d.priorities.join(' ＞ ') + '。可砍：' + d.cuts.join('；'),
    ],
    ['fuel', '吃饭、加油与休息', d.fuel.join('；') + '。每1.5—2小时休息。'],
    ['risk', '风险提醒与当天决策', d.decision || '不赶夜路，安全抵达优先。'],
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
      <section className="todo-sheet" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>新增待办</h2>
          <button onClick={close}>
            <X />
          </button>
        </header>
        <label>
          标题
          <input
            autoFocus
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
          关联节点
          <input
            value={draft.node}
            onChange={(e) => setDraft({ ...draft, node: e.target.value })}
            placeholder="可选"
          />
        </label>
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
          <button onClick={close}>取消</button>
          <button className="save" onClick={save}>
            保存
          </button>
        </footer>
      </section>
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
