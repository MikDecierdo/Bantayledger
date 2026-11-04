import { IonIcon } from '@ionic/react';
import {
  barChartOutline,
  bulbOutline,
  cartOutline,
  checkmarkCircle,
  chevronForwardOutline,
  cloudOfflineOutline,
  cloudDoneOutline,
  cubeOutline,
  homeOutline,
  notificationsOutline,
  sparklesOutline,
  trendingUpOutline,
} from 'ionicons/icons';
import {
  Component,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { t } from '../../i18n';
import './AppTour.css';

/**
 * A looping tour of the app for the sign-in and home pages, drawn in code rather
 * than filmed, so it stays sharp at any size and follows the chosen language.
 * A cursor opens each page from the menu and does the job, using sample data.
 */

/** Delay (seconds) before an element animates; `until` is when a swapped value leaves. */
const at = (start: number, until?: number) =>
  ({ '--t': `${start}s`, ...(until === undefined ? {} : { '--e': `${until}s` }) }) as CSSProperties;

/** Values that replace each other, such as a running total. Each entry: [text, from second]. */
function Swap({ values }: { values: [ReactNode, number][] }) {
  return (
    <span className="sc-swap">
      {values.map(([text, start], i) => {
        const next = values[i + 1];
        return (
          <span key={start} className={next ? '' : 'is-last'} style={at(start, next?.[1])}>
            {text}
          </span>
        );
      })}
    </span>
  );
}

function PageHead({ title, bellAt }: { title: string; bellAt?: number }) {
  return (
    <div className="sc-head">
      <strong className="sc-a sc-up" style={at(0.85)}>{title}</strong>
      <span className="sc-bell">
        <IonIcon icon={notificationsOutline} />
        {bellAt !== undefined && <i className="sc-a sc-pop" style={at(bellAt)}>1</i>}
      </span>
    </div>
  );
}

function DashboardScene() {
  return (
    <>
      <PageHead title={t('Dashboard')} />
      <div className="sc-stats">
        <div className="sc-stat sc-stat--main sc-a sc-up" style={at(1)} data-sc="today">
          <span>{t('Today')}</span>
          <b>₱3,420</b>
          <small>↑ 5.8%</small>
        </div>
        <div className="sc-stat sc-a sc-up" style={at(1.1)}>
          <span>{t('Low stock')}</span>
          <b>4</b>
        </div>
        <div className="sc-stat sc-a sc-up" style={at(1.2)}>
          <span>{t('Alerts')}</span>
          <b>2</b>
        </div>
      </div>
      <div className="sc-panel sc-a sc-up" style={at(1.35)} data-sc="chart">
        <svg viewBox="0 0 360 96" preserveAspectRatio="none" className="sc-chart">
          <path className="sc-a sc-fade" style={at(2.6)} d="M0 76 C40 60 70 66 110 50 S180 56 220 38 S300 30 360 12 V96 H0 Z" fill="#E9F4EF" />
          <g className="sc-a sc-reveal sc-reveal--slow" style={at(1.6)}>
            <path d="M0 76 C40 60 70 66 110 50 S180 56 220 38 S300 30 360 12" fill="none" stroke="#1F6F5B" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
      </div>
    </>
  );
}

function SalesScene() {
  const tiles: [string, string, string, number][] = [
    ['C1', 'Coke 1.5L', '₱75', 2.5],
    ['5S', '555 Sardines', '₱25', 3.1],
    ['LC', 'Pancit Canton', '₱17', 3.7],
  ];
  return (
    <>
      <div className="sc-head">
        <strong className="sc-a sc-up" style={at(0.85)}>{t('Sales')}</strong>
        <span className="sc-btn sc-btn--primary sc-a sc-up sc-pressed" style={at(0.95)} data-sc="add">
          + {t('Add Sale')}
        </span>
      </div>
      <div className="sc-pos sc-a sc-up" style={at(1.8)}>
        <div className="sc-pos__left">
          <div className="sc-tiles">
            {tiles.map(([mark, name, price, tap], i) => (
              <div key={mark} className="sc-tile sc-a sc-picked" style={at(tap)} data-sc={`tile${i}`}>
                <em>{mark}</em>
                <span>{name}</span>
                <b>{price}</b>
              </div>
            ))}
          </div>
          <div className="sc-pay">
            <span className="sc-choice sc-a sc-selected" style={at(4.35)} data-sc="cash">{t('Cash')}</span>
            <span className="sc-choice">{t('GCash')}</span>
          </div>
          <div className="sc-chips">
            <span className="sc-chip">₱100</span>
            <span className="sc-chip sc-a sc-selected" style={at(5.05)} data-sc="chip">₱200</span>
            <span className="sc-chip">₱500</span>
          </div>
        </div>
        <div className="sc-cart">
          {tiles.map(([mark, name, price, tap]) => (
            <div key={mark} className="sc-line sc-a sc-up" style={at(tap + 0.05)}>
              <span>{name}</span>
              <b>{price}</b>
            </div>
          ))}
          <div className="sc-cart__foot">
            <div className="sc-sum">
              <span>{t('Total')}</span>
              <b><Swap values={[['₱0', 1.8], ['₱75', 2.55], ['₱100', 3.15], ['₱117', 3.75]]} /></b>
            </div>
            <div className="sc-sum sc-sum--good sc-a sc-up" style={at(5.2)}>
              <span>{t('Change')}</span>
              <b>₱83</b>
            </div>
            <span className="sc-btn sc-btn--primary sc-btn--block" data-sc="checkout">{t('Checkout')}</span>
          </div>
        </div>
      </div>
      <div className="sc-toast sc-a sc-pop" style={at(6.2)}>
        <IonIcon icon={checkmarkCircle} /> {t('Sale recorded')}
      </div>
    </>
  );
}

function InventoryScene() {
  const rows: [string, ReactNode, string, string, ReactNode, number][] = [
    ['Rice 1kg', t('{{count}} kg', { count: 75 }), '80%', '80%', <span key="ok" className="sc-tag sc-tag--good">{t('Enough')}</span>, 1],
    [
      'Argentina Corned Beef',
      <Swap key="q" values={[[t('{{count}} cans', { count: 9 }), 1.1], [t('{{count}} cans', { count: 3 }), 2.3]]} />,
      '62%',
      '22%',
      <span key="low" className="sc-tag sc-tag--bad sc-a sc-pop sc-pulse" style={at(2.7)}>{t('Almost out')}</span>,
      1.1,
    ],
    ['Coke 1.5L', t('{{count}} bottles', { count: 24 }), '70%', '70%', <span key="ok2" className="sc-tag sc-tag--good">{t('Enough')}</span>, 1.2],
  ];
  return (
    <>
      <PageHead title={t('Inventory')} bellAt={3} />
      <div className="sc-rows">
        {rows.map(([name, qty, from, to, tag, start], i) => (
          <div key={name} className="sc-row sc-a sc-up" style={at(start)} data-sc={`row${i}`}>
            <div className="sc-row__top">
              <strong>{name}</strong>
              {tag}
            </div>
            <div className="sc-row__meta"><span>{qty}</span></div>
            <div className={`sc-bar${i === 1 ? ' sc-bar--bad' : ''}`}>
              <i
                className="sc-a sc-barfill"
                style={{ ...at(i === 1 ? 2.1 : start + 0.2), '--from': i === 1 ? from : '0%', width: to } as CSSProperties}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ForecastScene() {
  return (
    <>
      <PageHead title={t('Forecast')} />
      <div className="sc-chips sc-a sc-up" style={at(0.95)}>
        <span className="sc-chip sc-a sc-selected" style={at(1.55)} data-sc="product">Argentina Corned Beef</span>
        <span className="sc-chip">Coke 1.5L</span>
      </div>
      <div className="sc-panel sc-a sc-up" style={at(1.05)}>
        <svg viewBox="0 0 360 96" preserveAspectRatio="none" className="sc-chart">
          <path className="sc-a sc-fade" style={at(3.1)} d="M214 44 L360 16 V70 L214 56 Z" fill="#CFE5DB" />
          <line className="sc-a sc-fade" style={at(3)} x1="214" x2="214" y1="4" y2="92" stroke="#9FB5AB" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <g className="sc-a sc-reveal sc-reveal--slow" style={at(1.7)}>
            <path d="M0 72 L36 56 L72 66 L108 42 L144 58 L180 44 L214 50" fill="none" stroke="#1F6F5B" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          </g>
          <g className="sc-a sc-reveal" style={at(3.1)}>
            <path d="M214 50 L360 40" fill="none" stroke="#3E9C7C" strokeWidth="3" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
      </div>
      <div className="sc-metrics">
        <div className="sc-a sc-up" style={at(4)} data-sc="metric">
          <span>{t('Next 7 days')}</span>
          <b>{t('{{count}} cans', { count: 14 })}</b>
        </div>
        <div className="sc-a sc-up" style={at(4.15)}>
          <span>{t('On hand')}</span>
          <b>{t('{{count}} cans', { count: 3 })}</b>
        </div>
        <span className="sc-tag sc-tag--warn sc-a sc-pop" style={at(4.6)}>{t('Short by {{count}}', { count: 11 })}</span>
      </div>
    </>
  );
}

function InsightScene() {
  return (
    <>
      <PageHead title={t('AI Insights')} />
      <div className="sc-insight sc-a sc-up" style={at(1)}>
        <div className="sc-insight__tags">
          <span className="sc-tag sc-tag--good"><IonIcon icon={sparklesOutline} /> {t('AI Insight')}</span>
          <span className="sc-tag sc-tag--bad">{t('High impact')}</span>
        </div>
        <strong className="sc-a sc-up" style={at(1.4)}>{t('Restock {{name}}', { name: 'Argentina Corned Beef' })}</strong>
        <div className="sc-insight__block sc-a sc-up" style={at(2)}>
          <span>{t('Why this matters')}</span>
          <p>{t('You have {{stock}} cans, but should sell about {{need}} in the next 7 days.', { stock: 3, need: 14 })}</p>
        </div>
        <div className="sc-insight__block sc-a sc-up" style={at(2.8)}>
          <span>{t('Recommended action')}</span>
          <p>{t('Order {{count}} more before you run out.', { count: 11 })}</p>
        </div>
        <div className="sc-insight__foot sc-a sc-up" style={at(3.5)}>
          <small>{t('Based on your recorded data · {{pct}}% sure', { pct: 90 })}</small>
          <span className="sc-btn sc-btn--primary sc-pressed sc-pressed--order" data-sc="order">{t('Order')}</span>
        </div>
      </div>
    </>
  );
}

function OfflineScene() {
  const sales: [string, string, number][] = [
    ['Coke 1.5L +2', '₱117', 1.5],
    ['Pancit Canton +1', '₱42', 1.9],
  ];
  return (
    <>
      <div className="sc-head">
        <strong className="sc-a sc-up" style={at(0.85)}>{t('Sales')}</strong>
        <span className="sc-net" data-sc="net">
          <Swap
            values={[
              [<span key="off" className="sc-net__pill sc-net__pill--off"><IonIcon icon={cloudOfflineOutline} /> {t('No internet')}</span>, 0.95],
              [<span key="on" className="sc-net__pill sc-net__pill--on"><IonIcon icon={cloudDoneOutline} /> {t('Back online')}</span>, 3.9],
            ]}
          />
        </span>
      </div>
      <div className="sc-rows">
        {sales.map(([name, amount, start]) => (
          <div key={name} className="sc-row sc-row--sale sc-a sc-up" style={at(start)}>
            <strong>{name}</strong>
            <b>{amount}</b>
            <Swap
              values={[
                [<span key="wait" className="sc-tag sc-tag--warn">{t('Waiting to send')}</span>, start + 0.1],
                [<span key="sent" className="sc-tag sc-tag--good"><IonIcon icon={checkmarkCircle} /> {t('Sent')}</span>, start === 1.5 ? 4.4 : 4.8],
              ]}
            />
          </div>
        ))}
      </div>
    </>
  );
}

const NAV = [
  { icon: homeOutline, label: t('Dashboard') },
  { icon: cubeOutline, label: t('Inventory') },
  { icon: cartOutline, label: t('Sales') },
  { icon: trendingUpOutline, label: t('Forecast') },
  { icon: bulbOutline, label: t('AI Insights') },
  { icon: barChartOutline, label: t('Reports') },
];

interface CursorStep {
  to: string;
  at: number;
  click?: boolean;
}

/** `nav` is the menu row that the cursor opens at the start of the step. */
const SCENES: {
  nav: number;
  seconds: number;
  title: string;
  body: string;
  path: CursorStep[];
  Content: () => ReactNode;
}[] = [
  {
    nav: 0,
    seconds: 6.5,
    title: t('See your store at a glance'),
    body: t('Today\'s sales, low stock and alerts are the first thing you see.'),
    path: [{ to: 'nav', at: 0.7, click: true }, { to: 'today', at: 3.1 }, { to: 'chart', at: 4.2 }],
    Content: DashboardScene,
  },
  {
    nav: 2,
    seconds: 8.2,
    title: t('Record a sale in a few taps'),
    body: t('Tap products, choose Cash or GCash, and the change is worked out for you.'),
    path: [
      { to: 'nav', at: 0.7, click: true },
      { to: 'add', at: 1.6, click: true },
      { to: 'tile0', at: 2.45, click: true },
      { to: 'tile1', at: 3.05, click: true },
      { to: 'tile2', at: 3.65, click: true },
      { to: 'cash', at: 4.3, click: true },
      { to: 'chip', at: 5, click: true },
      { to: 'checkout', at: 6, click: true },
    ],
    Content: SalesScene,
  },
  {
    nav: 1,
    seconds: 6.5,
    title: t('Track stock in real time'),
    body: t('Know what is running low before it runs out.'),
    path: [{ to: 'nav', at: 0.7, click: true }, { to: 'row1', at: 3.5 }],
    Content: InventoryScene,
  },
  {
    nav: 3,
    seconds: 7,
    title: t('Know what to buy and what it costs'),
    body: t('See what you will need next week and what it will cost.'),
    path: [{ to: 'nav', at: 0.7, click: true }, { to: 'product', at: 1.5, click: true }, { to: 'metric', at: 4.5 }],
    Content: ForecastScene,
  },
  {
    nav: 4,
    seconds: 6.8,
    title: t('Act on clear recommendations'),
    body: t('Plain-language guidance backed by your own records.'),
    path: [{ to: 'nav', at: 0.7, click: true }, { to: 'order', at: 4.6, click: true }],
    Content: InsightScene,
  },
  {
    nav: 2,
    seconds: 6.8,
    title: t('Works offline'),
    body: t('Keep recording when the signal drops. Everything syncs once you are back online.'),
    path: [{ to: 'nav', at: 0.7, click: true }, { to: 'net', at: 3.7 }],
    Content: OfflineScene,
  },
];

/** Moves the pointer and its click ring along a step's path. */
function animatePointer(stage: HTMLElement, pointer: HTMLElement, ring: HTMLElement, path: CursorStep[], seconds: number) {
  const place = (name: string) => {
    let el = stage.querySelector<HTMLElement>(`[data-sc="${name}"]`);
    // Small stages hide the mini menu, so there's nothing there to point at.
    if (!el || el.offsetParent === null) return null;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    let x = 0;
    let y = 0;
    // Layout offsets, because many targets are still mid slide-up when this runs.
    while (el && el !== stage) {
      x += el.offsetLeft;
      y += el.offsetTop;
      el = el.offsetParent as HTMLElement | null;
    }
    return { x: x + width / 2, y: y + height / 2 };
  };

  let from = { x: stage.offsetWidth * 0.72, y: stage.offsetHeight * 0.72 };
  const move = ({ x, y }: { x: number; y: number }, scale = 1) => `translate(${x}px, ${y}px) scale(${scale})`;
  const frames: Keyframe[] = [{ transform: move(from), offset: 0 }];
  const rings: Keyframe[] = [{ transform: move(from, 0), opacity: 0, offset: 0 }];
  // Offsets may never go backwards, even when one click's ring outlasts the next move.
  const add = (list: Keyframe[], frame: Keyframe, second: number) => {
    const last = (list[list.length - 1].offset as number) ?? 0;
    list.push({ ...frame, offset: Math.max(last, Math.min(second / seconds, 1)) });
  };

  for (const step of path) {
    const to = place(step.to);
    if (!to) continue;
    add(frames, { transform: move(from) }, step.at - 0.5);
    add(frames, { transform: move(to), easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)' }, step.at);
    if (step.click) {
      add(frames, { transform: move(to, 0.8) }, step.at + 0.07);
      add(frames, { transform: move(to) }, step.at + 0.17);
      add(rings, { transform: move(to, 0), opacity: 0 }, step.at - 0.01);
      add(rings, { transform: move(to, 0.1), opacity: 0.55 }, step.at);
      add(rings, { transform: move(to, 1), opacity: 0 }, step.at + 0.4);
    }
    from = to;
  }
  add(frames, { transform: move(from) }, seconds);
  add(rings, { transform: move(from, 0), opacity: 0 }, seconds);

  const timing = { duration: seconds * 1000, fill: 'both' as const };
  pointer.animate(frames, timing);
  ring.animate(rings, timing);
}

/** The tour is decoration: if it ever fails, it steps aside and sign-in carries on. */
class TourBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface AppTourProps {
  /** Don't load at all on phones, for pages where the panel only shows on desktop. */
  desktopOnly?: boolean;
  /** Caption colours: `dark` for a dark background, `light` for a light one. */
  tone?: 'dark' | 'light';
}

export function AppTour(props: AppTourProps) {
  return (
    <TourBoundary>
      <Tour {...props} />
    </TourBoundary>
  );
}

/**
 * Style for the panel around the tour. Its photo zooms slowly in a 56-second
 * cycle; timing it from when the app opened keeps the zoom continuous when the
 * page changes between sign-in and Create account, instead of jumping back.
 */
export function tourPanelStyle(): CSSProperties {
  return { '--bl-drift-delay': `-${((performance.now() / 1000) % 56).toFixed(2)}s` } as CSSProperties;
}

/** With reduced motion, each step shows finished and changes after this many seconds. */
const STILL_SECONDS = 9;

/**
 * Which step is playing and since when (`performance.now()`), kept between pages.
 * Going from sign-in to Create account (or back) then carries on from the very same
 * moment, so both pages show the same picture and the panel morphs as one.
 */
const playing = { step: 0, startedAt: 0 };

/** Where the other page's tour is right now, if it was showing a moment ago. */
function resumeFromLastPage() {
  if (!playing.startedAt) return null;
  const elapsed = (performance.now() - playing.startedAt) / 1000;
  if (elapsed > 60) return null;
  const seconds = SCENES[playing.step].seconds;
  // Its step has already ended: start the next one from its beginning.
  if (elapsed >= seconds - 0.05) return { step: (playing.step + 1) % SCENES.length, elapsed: 0 };
  return { step: playing.step, elapsed };
}

function Tour({ desktopOnly = false, tone = 'dark' }: AppTourProps) {
  const [show, setShow] = useState(() => !desktopOnly || window.matchMedia('(min-width: 1024px)').matches);
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [resume] = useState(resumeFromLastPage);
  const [step, setStep] = useState(resume?.step ?? 0);
  const [run, setRun] = useState(0);
  const tourRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!desktopOnly) return;
    const query = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setShow(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [desktopOnly]);

  const scene = SCENES[step];

  // Seconds already played of this step: only the first step on a page that picks
  // up where the other page was. Worked out from the state, so running twice is safe.
  const offset = run === 0 && resume && step === resume.step ? resume.elapsed : 0;

  // Runs before the first paint, so the page never shows the step from its start.
  useLayoutEffect(() => {
    if (!show) return;
    playing.step = step;
    playing.startedAt = performance.now() - offset * 1000;
    if (reduced) return;
    const stage = stageRef.current;
    const pointer = pointerRef.current;
    const ring = ringRef.current;
    if (stage && pointer && ring) animatePointer(stage, pointer, ring, scene.path, scene.seconds);
    // Jump every part of the step (and its caption) to where the other page was.
    if (offset > 0 && tourRef.current) {
      for (const animation of tourRef.current.getAnimations({ subtree: true })) {
        animation.currentTime = offset * 1000;
      }
    }
  }, [show, reduced, step, run, scene, offset]);

  useEffect(() => {
    if (!show) return;
    const seconds = (reduced ? STILL_SECONDS : scene.seconds) - offset;
    const timer = window.setTimeout(() => {
      setStep((s) => (s + 1) % SCENES.length);
      setRun((r) => r + 1);
    }, Math.max(0, seconds) * 1000);
    return () => window.clearTimeout(timer);
  }, [show, reduced, step, run, scene, offset]);

  // A new width moves the pointer's targets, so the step starts over. Height doesn't
  // count: phone browsers change it whenever the address bar hides during scrolling.
  useEffect(() => {
    if (!show || reduced) return;
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      setRun((r) => r + 1);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [show, reduced]);

  if (!show) return null;

  const previousNav = SCENES[(step - 1 + SCENES.length) % SCENES.length].nav;
  const Content = scene.Content;

  return (
    <div ref={tourRef} className={`bl-tour bl-tour--${tone}${desktopOnly ? ' bl-tour--desktop' : ''}${reduced ? ' is-frozen' : ''}`}>
      <div className="bl-tour__frame" aria-hidden="true">
        <div ref={stageRef} className="bl-tour__stage" key={`${step}-${run}`}>
          <div className="sc-side">
            <div className="sc-brand">
              <img src="/brand-logo.png" alt="" />
              <span>BantayLedger</span>
            </div>
            {NAV.map((item, i) => (
              <div
                key={item.label}
                className={`sc-nav${i === scene.nav ? ' sc-a sc-nav--to' : ''}${i === previousNav && i !== scene.nav ? ' sc-a sc-nav--from' : ''}`}
                style={at(0.7)}
                data-sc={i === scene.nav ? 'nav' : undefined}
              >
                <IonIcon icon={item.icon} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="sc-main">
            <div className="sc-skel">
              <i />
              <i />
              <i />
            </div>
            <Content />
            <span className="sc-sample">{t('Sample data')}</span>
          </div>
          <div ref={ringRef} className="sc-ring" />
          <div ref={pointerRef} className="sc-pointer">
            <svg viewBox="0 0 24 24" width="100%" height="100%">
              <path d="M5 2 L5 20 L10 15.5 L13.5 22 L16.5 20.5 L13 14 L19.5 14 Z" fill="#17222E" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* All six share one spot, so the height always fits the longest and the page doesn't jump. */}
      <div className="bl-tour__captions">
        {SCENES.map((s, i) => (
          <div key={s.title} className={`bl-tour__caption${i === step ? ' is-on' : ''}`}>
            <p className="bl-tour__where">
              <span>{t('Step {{n}} of {{total}}', { n: i + 1, total: SCENES.length })}</span>
              <IonIcon icon={chevronForwardOutline} aria-hidden="true" />
              <span>{t('In the menu: {{page}}', { page: NAV[s.nav].label })}</span>
            </p>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AppTour;
