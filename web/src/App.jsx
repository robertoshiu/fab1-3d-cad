import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowCounterClockwise, ArrowsOut, Check, Cube, Info, List, MagnifyingGlass, Moon, Pause, Play, Sun, X } from '@phosphor-icons/react';
import { TwinViewer } from './engine.js';
import { OPERATION_VIEWS } from './operations.js';

const CHAPTERS = [
  { id: 'EXTERIOR', title: '廠房外觀', floor: 'ALL', cutaway: false, label: '全區', description: '從 A、B 兩區與中央通廊，認識全廠的空間配置。' },
  { id: 'HERO', title: '樓層關係', floor: 'ALL', cutaway: true, label: '全區剖視', description: '打開外殼，查看製程區、支援設備與空調夾層之間的關係。' },
  { id: 'CLEANROOM', title: '製程與搬運', floor: 'F1', cutaway: true, label: '1F', description: '進入 A-S3 製程區，近看 CVD 機台、FOUP 接口與 OHT 搬運軌道。' },
  { id: 'B1', title: '支援設備', floor: 'B1', cutaway: true, label: 'B1', description: '沿設備接管，查看乾泵、除害設備與公用系統的部署。' },
  { id: 'PLENUM', title: '空調與回風', floor: 'F2', cutaway: true, label: '2F', description: '由 FFU 陣列與回風夾層，理解潔淨室上方的空氣處理配置。' },
  { id: 'ROOF', title: '屋頂機械', floor: 'RF', cutaway: true, label: 'RF', description: '查看 MAU、AHU 與排氣設備，再回到全廠總覽。' },
];
const FLOORS = [
  { id: 'ALL', title: '全區', detail: '全部樓層' },
  { id: 'B1', title: 'B1', detail: '支援設備' },
  { id: 'F1', title: '1F', detail: '製程區' },
  { id: 'F2', title: '2F', detail: '空調夾層' },
  { id: 'RF', title: 'RF', detail: '屋頂機械' },
];
const ICON = { size: 19, weight: 'regular', 'aria-hidden': true };
const DURATION = 12000;
const publicUrl = (path) => `${import.meta.env.BASE_URL}${path}`;
const floorName = (id) => FLOORS.find((item) => item.id === id)?.title || id || '未提供';

function Toggle({ checked, onChange, label, hint, disabled }) {
  return <label className={`setting-row${disabled ? ' is-disabled' : ''}`}>
    <span><span className="setting-title">{label}</span>{hint && <span className="setting-hint">{hint}</span>}</span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
    <span className="toggle" aria-hidden="true"><span /></span>
  </label>;
}

export default function App() {
  const hostRef = useRef(null);
  const stageRef = useRef(null);
  const viewerRef = useRef(null);
  const dialogRef = useRef(null);
  const railRef = useRef(null);
  const mobileTriggerRef = useRef(null);
  const wasMobileOpen = useRef(false);
  const playingRef = useRef(false);
  const remainingRef = useRef(DURATION);
  const deadlineRef = useRef(0);
  const pauseRef = useRef(() => {});
  const applyChapterRef = useRef(() => {});
  const finishRef = useRef(() => {});
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0, ratio: 0, label: '準備模型' });
  const [error, setError] = useState('');
  const [assets, setAssets] = useState([]);
  const [systems, setSystems] = useState([]);
  const [mode, setMode] = useState('tour');
  const [chapter, setChapter] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [floor, setFloor] = useState('ALL');
  const [system, setSystem] = useState('ALL');
  const [cutaway, setCutaway] = useState(true);
  const [exploded, setExploded] = useState(false);
  const [query, setQuery] = useState('');
  const [quality, setQuality] = useState('auto');
  const [operating, setOperating] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [operationSpeed,setOperationSpeed]=useState(1);
  const [flow,setFlow]=useState(false);
  const [operationView,setOperationView]=useState('');
  const [operationStatus,setOperationStatus]=useState('');
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('fab1-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
    catch { return 'light'; }
  });
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);

  const pauseTour = useCallback((message = '導覽已暫停，可自由旋轉模型。') => {
    if (playingRef.current) {
      remainingRef.current = Math.max(300, deadlineRef.current - performance.now());
      playingRef.current = false;
      setPlaying(false);
      viewerRef.current?.cancelMove();
      setNote(message);
    }
  }, []);
  pauseRef.current = pauseTour;

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const change = (event) => { setReducedMotion(event.matches); if (event.matches) {setOperating(false);pauseRef.current('已啟用減少動態，設備運轉與鏡頭已暫停。');} };
    preference.addEventListener('change', change);
    return () => preference.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    let alive = true;
    const viewer = new TwinViewer({
      host: hostRef.current,
      onLoad: (data) => {
        if (!alive) return;
        setAssets(data.assets || []);
        setSystems(data.systems || []);
        setLoaded(true);
        setError('');
        setNote('模型已就緒。開始導覽，或切換至自由探索。');
      },
      onProgress: (data) => { if (alive) setProgress(data); },
      onSelect: (asset) => { if (alive) setSelected(asset); },
      onInteract: () => { if (alive) pauseRef.current(); },
      onError: (message) => {
        if (!alive) return;
        pauseRef.current('模型暫時無法顯示，導覽已暫停。');
        setLoaded(false);
        setError(String(message || '模型載入失敗'));
      },
    });
    viewerRef.current = viewer;
    window.__twin = viewer;
    Promise.resolve(viewer.init()).catch((issue) => {
      if (!alive) return;
      pauseRef.current('模型暫時無法顯示，導覽已暫停。');
      setLoaded(false);
      setError(issue?.message || String(issue));
    });
    return () => {
      alive = false;
      viewer.dispose();
      if (window.__twin === viewer) delete window.__twin;
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('fab1-theme', theme); } catch { /* Storage can be disabled by the browser. */ }
    viewerRef.current?.setTheme(theme);
  }, [theme, loaded]);

  useEffect(()=>{if(!loaded)return;const timer=setInterval(()=>{const op=viewerRef.current?.operations;if(op)setOperationStatus(operationView==='OHT'?op.oht[0].state.phase:operationView==='LOGISTICS'?op.traffic.phase:'');},500);return()=>clearInterval(timer);},[loaded,operationView]);

  const applyChapter = useCallback((index, continuePlaying = false) => {
    if (!loaded || error) return;
    const item = CHAPTERS[index];
    if (!item) return;
    const viewer = viewerRef.current;
    remainingRef.current = DURATION;
    playingRef.current = continuePlaying && !reducedMotion;
    setPlaying(playingRef.current);
    setChapter(index);
    setOperationView('');
    setFinished(false);
    setSelected(null);
    setMode('tour');
    setFloor(item.floor);
    setSystem('ALL');
    setCutaway(item.cutaway);
    setExploded(false);
    viewer.setSystem('ALL');
    viewer.setFloor(item.floor);
    viewer.setCutaway(item.cutaway);
    viewer.setExploded(false);
    viewer.goToShot(item.id, reducedMotion ? 0 : 1800);
    setNote(reducedMotion ? '已啟用減少動態，按下一站繼續。' : continuePlaying ? `正在導覽：${item.title}` : `已前往：${item.title}`);
    setMobileOpen(false);
  }, [loaded, reducedMotion, error]);
  applyChapterRef.current = applyChapter;

  const returnOverview = useCallback((completed = false) => {
    playingRef.current = false;
    setPlaying(false);
    remainingRef.current = DURATION;
    setChapter(-1);
    setOperationView('');
    setFloor('ALL');
    setSystem('ALL');
    setCutaway(true);
    setExploded(false);
    setSelected(null);
    setFinished(completed);
    const viewer = viewerRef.current;
    viewer.setSystem('ALL');
    viewer.setFloor('ALL');
    viewer.setCutaway(true);
    viewer.setExploded(false);
    viewer.goToShot('HERO', reducedMotion ? 0 : 1500);
    setNote(completed ? '導覽完成。可重播，或切換至自由探索。' : '已返回全廠總覽。');
  }, [reducedMotion]);
  finishRef.current = () => returnOverview(true);

  useEffect(() => {
    if (!playing || !loaded || reducedMotion || chapter < 0) return;
    deadlineRef.current = performance.now() + remainingRef.current;
    const timer = setTimeout(() => {
      remainingRef.current = DURATION;
      if (chapter + 1 < CHAPTERS.length) applyChapterRef.current(chapter + 1, true);
      else finishRef.current();
    }, remainingRef.current);
    return () => clearTimeout(timer);
  }, [playing, loaded, chapter, reducedMotion]);

  useEffect(() => {
    window.__tourState = { mode, chapter, playing, finished, floor, system, cutaway, exploded, loaded, error, reducedMotion, selected: selected?.id || null };
  }, [mode, chapter, playing, finished, floor, system, cutaway, exploded, loaded, error, reducedMotion, selected]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (aboutOpen && !dialog.open) dialog.showModal();
    if (!aboutOpen && dialog.open) dialog.close();
  }, [aboutOpen]);

  useEffect(() => {
    if (mobileOpen && matchMedia('(max-width: 767px)').matches) {
      railRef.current?.querySelector('button')?.focus();
    } else if (wasMobileOpen.current && matchMedia('(max-width: 767px)').matches) {
      mobileTriggerRef.current?.focus();
    }
    wasMobileOpen.current = mobileOpen;
    const escape = (event) => {
      if (event.key === 'Escape' && mobileOpen && !dialogRef.current?.open) {
        event.preventDefault();
        setMobileOpen(false);
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [mobileOpen]);

  const startOrPause = () => {
    if (!loaded || error) return;
    if (playing) { pauseTour(); return; }
    if (chapter < 0 || finished) { applyChapter(0, !reducedMotion); return; }
    if (reducedMotion) {
      if (chapter === CHAPTERS.length - 1) returnOverview(true);
      else applyChapter(chapter + 1, false);
      return;
    }
    const item = CHAPTERS[chapter];
    viewerRef.current.setSystem('ALL');
    viewerRef.current.setFloor(item.floor);
    viewerRef.current.setCutaway(item.cutaway);
    viewerRef.current.setExploded(false);
    viewerRef.current.goToShot(item.id, 1200);
    setFloor(item.floor);
    setSystem('ALL');
    setCutaway(item.cutaway);
    setExploded(false);
    setMode('tour');
    setPlaying(true);
    playingRef.current = true;
    setNote('導覽已繼續。');
    setMobileOpen(false);
  };

  const changeMode = (next) => {
    if (next === 'explore') {
      pauseTour('已切換至自由探索。');
      setFinished(false);
    }
    setMode(next);
  };

  const changeFloor = (value) => {
    pauseTour();
    viewerRef.current.setFloor(value);
    setFloor(value);
    setSystem('ALL');
    setExploded(false);
    setSelected(null);
    setChapter(-1);
    setOperationView('');
    setFinished(false);
    setNote(`顯示${FLOORS.find((item) => item.id === value)?.detail || value}。`);
  };

  const changeCutaway = (value) => {
    pauseTour();
    setCutaway(value);
    viewerRef.current.setCutaway(value);
  };
  const changeExploded = (value) => {
    pauseTour();
    setExploded(value);
    viewerRef.current.setExploded(value);
  };
  const changeSystem = (value) => {
    pauseTour();
    setSystem(value);
    setSelected(null);
    viewerRef.current.setSystem(value);
  };

  const searchResults = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return assets.filter((asset) => {
      const compatibleFloor = floor === 'ALL' || asset.floor === floor;
      const compatibleSystem = system === 'ALL' || asset.system === system;
      const text = `${asset.label || ''} ${asset.id || ''} ${asset.tags || ''} ${asset.system || ''} ${asset.name || ''}`.toLocaleLowerCase();
      return compatibleFloor && compatibleSystem && (!term || text.includes(term));
    });
  }, [assets, floor, system, query]);

  const selectAsset = (asset) => {
    pauseTour();
    setSelected(asset);
    viewerRef.current.focusAsset(asset.id);
    setFloor(['B1', 'F1', 'F2', 'RF'].includes(asset.floor) ? asset.floor : 'ALL');
    setSystem('ALL');
    setExploded(false);
    const collection = asset.sourceCollection || '';
    if (collection.includes('Facade_B_Openable') || collection.includes('Site_FullGround')) setCutaway(false);
    if (collection.includes('Site_Cutaway')) setCutaway(true);
    setMobileOpen(false);
  };

  const changeOperating = value => {setOperating(value);viewerRef.current?.operations?.setEnabled(value);};
  const changeFlow = value => {setFlow(value);viewerRef.current?.operations?.setFlow(value);};
  const focusOperation = key => {
    pauseTour();const view=OPERATION_VIEWS[key];viewerRef.current.focusOperation(key);
    setMode('explore');setChapter(-1);setFinished(false);setFloor(view.floor);setSystem('ALL');setExploded(false);setCutaway(view.floor!=='ALL');setSelected(null);setOperationView(key);setMobileOpen(false);
    setFlow(viewerRef.current.operations.flow);setNote(`已前往${view.title}，設備運轉與鏡頭導覽可分別暫停。`);
  };

  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current.closest('.app-shell').requestFullscreen();
    } catch { setNote('此瀏覽器無法開啟全螢幕，可使用瀏覽器的全螢幕功能。'); }
  };

  const currentChapter = CHAPTERS[chapter];
  const overviewTitle = exploded ? '樓層分離總覽' : cutaway ? '全廠剖視總覽' : '廠房外觀總覽';
  const ratio = Math.min(1, Math.max(0, Number(progress.ratio) || 0));
  const loadLabel = ({ shell: '正在載入廠房外殼', site: '正在載入周邊場地', B1: '正在載入 B1 支援設備', F1: '正在載入 1F 製程區', F2: '正在載入 2F 空調夾層', RF: '正在載入屋頂機械', '完成': '模型已就緒' })[progress.label] || progress.label || '正在載入模型';
  const actionLabel = playing ? '暫停導覽' : finished ? '重新導覽' : chapter < 0 ? '開始導覽' : reducedMotion ? chapter === CHAPTERS.length - 1 ? '完成導覽' : '下一站' : '繼續導覽';

  return <div className="app-shell">
    <a className="skip-link" href="#viewer-controls">跳至模型操作</a>
    <header className="topbar">
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); if (loaded) returnOverview(); }} aria-label="FAB-1 返回全廠總覽"><Cube {...ICON} size={23} /><span>FAB-1</span></a>
      <span className="project-kind">視覺數位孿生</span>
      <div className="header-actions">
        <button type="button" className="icon-button" onClick={() => setAboutOpen(true)} aria-label="關於模型" title="關於模型"><Info {...ICON} /></button>
        <button type="button" className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? '切換淺色模式' : '切換深色模式'} title={theme === 'dark' ? '淺色模式' : '深色模式'}>{theme === 'dark' ? <Sun {...ICON} /> : <Moon {...ICON} />}</button>
        <a className="render-link" href={publicUrl('gallery/HERO.webp')} target="_blank" rel="noreferrer">渲染總覽<ArrowRight {...ICON} size={14} /></a>
      </div>
    </header>

    <div className="workspace">
      <aside className={`project-rail${mobileOpen ? ' mobile-open' : ''}`} ref={railRef} aria-label="導覽與探索">
        <div className="rail-mobile-header"><span>導覽與探索</span><button className="icon-button" aria-label="收合操作面板" onClick={() => setMobileOpen(false)}><X {...ICON} /></button></div>
        <div className="rail-heading"><h1>全廠設備<br />與管線</h1><p>從製程設備到支援系統，<br className="desktop-break" />逐層查看廠房配置。</p></div>
        <div className="mode-tabs" role="group" aria-label="瀏覽模式">
          <button className={mode === 'tour' ? 'active' : ''} type="button" aria-pressed={mode === 'tour'} onClick={() => changeMode('tour')}>導覽</button>
          <button className={mode === 'explore' ? 'active' : ''} type="button" aria-pressed={mode === 'explore'} onClick={() => changeMode('explore')}>自由探索</button>
        </div>

        <div className="rail-scroll">
          <section className="operation-panel" aria-label="廠區示範運轉">
            <div className="operation-heading"><h2>廠區運轉</h2><span>示範情境</span></div>
            <div className="operation-playback"><button type="button" className="operation-play" disabled={!loaded||!!error} onClick={()=>changeOperating(!operating)} aria-pressed={operating}>{operating?<Pause {...ICON} />:<Play {...ICON} />}<span>{operating?'暫停設備':'啟動設備'}</span></button><label className="operation-speed"><span>速度</span><select aria-label="運轉速度" value={operationSpeed} disabled={!loaded||!!error} onChange={e=>{setOperationSpeed(Number(e.target.value));viewerRef.current.operations.setSpeed(e.target.value);}}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label></div>
            <div className="operation-views" role="group" aria-label="運轉近景">{Object.entries(OPERATION_VIEWS).map(([key,view])=><button key={key} type="button" className={operationView===key?'active':''} disabled={!loaded||!!error} onClick={()=>focusOperation(key)}>{view.title}<ArrowRight {...ICON} size={12}/></button>)}</div>
            <Toggle checked={flow} onChange={changeFlow} label="顯示流向" hint="示意標記，非流體計算" disabled={!loaded||!!error}/>
            <p className="operation-disclaimer">依設備原理模擬，未連接即時資料。<a href={publicUrl('sources/OPERATING_MODES.md')} target="_blank" rel="noreferrer">運轉依據</a></p>
          </section>
          {mode === 'tour' ? <section className="tour-panel" aria-label="導覽章節">
            <button className="primary-button tour-start" type="button" disabled={!loaded || !!error} onClick={startOrPause}>{playing ? <Pause {...ICON} weight="fill" /> : <Play {...ICON} weight="fill" />}<span>{actionLabel}</span></button>
            <p className="tour-duration">{reducedMotion ? '逐站檢視，減少鏡頭動態' : '六個視角，約 72 秒'}</p>
            <nav className="chapter-list" aria-label="跳至導覽章節">{CHAPTERS.map((item, index) => <button type="button" key={item.id} disabled={!loaded || !!error} className={`chapter-button${chapter === index ? ' active' : ''}`} aria-current={chapter === index ? 'step' : undefined} onClick={() => applyChapter(index, false)}>
              <span className="chapter-level">{item.label}</span><span className="chapter-title">{item.title}</span><ArrowRight {...ICON} size={14} />
            </button>)}</nav>
            <p className="rail-help">拖曳模型即可暫停導覽。<br />隨時回到目前章節繼續。</p>
          </section> : <section className="explore-panel" aria-label="探索設定">
            <div className="control-section"><label className="control-label" htmlFor="quality-filter">顯示品質</label><select id="quality-filter" value={quality} disabled={!loaded || !!error} onChange={e=>{setQuality(e.target.value);viewerRef.current?.setQuality(e.target.value);}}><option value="auto">自動（依裝置調整）</option><option value="smooth">流暢（減少光影負擔）</option><option value="detail">精細（完整材質光影）</option></select></div>
            <div className="control-section"><h2>樓層</h2><div className="floor-buttons" role="group" aria-label="選擇樓層">{FLOORS.map((item) => <button type="button" key={item.id} disabled={!loaded || !!error} className={floor === item.id ? 'active' : ''} aria-pressed={floor === item.id} title={item.detail} onClick={() => changeFloor(item.id)}>{item.title}</button>)}</div></div>
            <div className="control-section settings">
              <Toggle checked={cutaway} onChange={changeCutaway} label="打開外殼" disabled={!loaded || !!error} />
              <Toggle checked={exploded} onChange={changeExploded} label="樓層分離" hint="展開樓層間的空間關係" disabled={!loaded || floor !== 'ALL' || !!error} />
            </div>
            <div className="control-section"><label className="control-label" htmlFor="system-filter">設備與管線系統</label><select id="system-filter" value={system} onChange={(event) => changeSystem(event.target.value)} disabled={!loaded || !!error}><option value="ALL">所有系統</option>{systems.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
            <div className="control-section asset-search"><label className="control-label" htmlFor="asset-search">尋找設備</label><div className="search-input"><MagnifyingGlass {...ICON} size={17} /><input id="asset-search" type="search" placeholder="名稱或設備編號" value={query} disabled={!loaded || !!error} onChange={(event) => setQuery(event.target.value)} /></div><p className="result-count">{loaded ? `${searchResults.length.toLocaleString()} 個符合項目` : '模型載入後可搜尋'}</p>
              <div className="search-results">{searchResults.slice(0, 12).map((asset) => <button type="button" key={asset.id} disabled={!loaded || !!error} className={selected?.id === asset.id ? 'asset-result selected' : 'asset-result'} onClick={() => selectAsset(asset)}><span>{asset.label || asset.name || asset.id}</span><small>{floorName(asset.floor)}{asset.system ? ` / ${asset.system}` : ''}</small></button>)}{loaded && searchResults.length === 0 && <p className="empty-state">沒有符合的設備。<br />試試其他名稱，或切換樓層與系統。</p>}</div>
              {searchResults.length > 12 && <p className="result-more">顯示前 12 項，輸入名稱可縮小範圍。</p>}
            </div>
          </section>}
        </div>
        <div className="rail-footer"><span>設計資料模型</span><button type="button" onClick={() => setAboutOpen(true)}>資料依據<ArrowRight {...ICON} size={13} /></button></div>
      </aside>

      <main className="model-stage" ref={stageRef} aria-label="FAB-1 互動模型">
        <div className="canvas-host" ref={hostRef} aria-label="可旋轉、平移與縮放的廠房三維模型" />
        <div className={`model-loading${loaded && !error ? ' complete' : ''}`} aria-hidden={loaded && !error ? true : undefined}>
          <img src={publicUrl('poster.webp')} className="loading-poster" alt="FAB-1 廠房剖視模型預覽" fetchPriority="high" />
          <div className="loading-shade" />
          {error ? <div className="loading-message error-message" role="alert"><h2>暫時無法載入互動模型</h2><p>{error}</p><div className="loading-actions"><button className="primary-button" type="button" onClick={() => location.reload()}><ArrowCounterClockwise {...ICON} />重新載入</button><a href={publicUrl('gallery/HERO.webp')} target="_blank" rel="noreferrer">查看渲染總覽<ArrowRight {...ICON} size={16} /></a></div></div> : <div className="loading-message" role="status"><span className="load-eyebrow">準備進入全廠</span><h2>{loadLabel}</h2><div className="load-progress" role="progressbar" aria-label="模型載入進度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}><span style={{ transform: `scaleX(${ratio})` }} /></div><p><span>{Math.round(ratio * 100)}%</span><span>首次載入需要下載模型</span></p></div>}
        </div>

        {loaded&&!error&&<button className="operation-badge" type="button" onClick={()=>changeOperating(!operating)} aria-label={operating?'暫停設備運轉':'啟動設備運轉'}><span className={operating?'operation-dot active':'operation-dot'}/>{operating?'示範運轉中':'設備已暫停'}{operating?<Pause {...ICON} size={13}/>:<Play {...ICON} size={13}/>}</button>}
        <div className="viewport-topline"><span className="view-mode-label">{mode === 'tour' ? playing ? '導覽中' : finished ? '導覽完成' : chapter >= 0 ? '導覽已暫停' : '導覽視角' : '自由探索'}</span><span className="view-floor">{floor === 'ALL' ? '全廠' : floorName(floor)}</span></div>
        <div id="viewer-controls" className="viewport-tools" tabIndex={-1} aria-label="模型操作">
          <button type="button" className="tool-button" disabled={!loaded || !!error} onClick={() => returnOverview()} title="返回總覽" aria-label="返回全廠總覽"><ArrowCounterClockwise {...ICON} /></button>
          <button type="button" className={`tool-button${cutaway ? ' active' : ''}`} disabled={!loaded || !!error} onClick={() => changeCutaway(!cutaway)} title={cutaway ? '關閉剖視外殼' : '打開外殼'} aria-label="打開外殼" aria-pressed={cutaway}><Cube {...ICON} /></button>
          <button type="button" className="tool-button" onClick={fullscreen} title="全螢幕" aria-label="全螢幕顯示"><ArrowsOut {...ICON} /></button>
        </div>

        {selected && loaded && <section className="asset-detail" aria-label="設備資訊"><div className="detail-heading"><span>設備資訊</span><button type="button" className="icon-button" onClick={() => { setSelected(null); viewerRef.current?.clearSelection?.(); }} aria-label="關閉設備資訊"><X {...ICON} size={17} /></button></div><h2>{selected.label || selected.name || selected.id}</h2><dl><div><dt>樓層</dt><dd>{floorName(selected.floor)}</dd></div><div><dt>系統</dt><dd>{selected.system || '未提供'}</dd></div>{selected.tags && <div><dt>設備標記</dt><dd>{Array.isArray(selected.tags) ? selected.tags.join(', ') : selected.tags}</dd></div>}<div className="source-id"><dt>來源 ID</dt><dd>{selected.id}</dd></div></dl><p>依設計資料建立</p></section>}

        <div className="viewport-bottom">
          <div className="scene-caption"><h2>{operationView ? OPERATION_VIEWS[operationView].title : mode === 'tour' && currentChapter ? currentChapter.title : finished ? '全廠導覽完成' : floor === 'ALL' ? overviewTitle : `${floorName(floor)} ${FLOORS.find((item) => item.id === floor)?.detail || ''}`}</h2><p>{operationView ? ({OHT:'沿既有軌道停靠、升降與移交 FOUP。',LOGISTICS:'減速停等、閘門放行、車尾離開後關閉。',DOORS:'裝卸門依開啟、保持與關閉順序循環。',AIR:'FFU 葉輪持續旋轉，箭頭表示進風方向。',ROOF:'排氣風機持續運轉，轉速採便於辨識的視覺示意。',UTILITIES:'PCW 供回水方向示意，管線與機殼保持固定。'}[operationView]+(operationStatus?' '+operationStatus+'。':'')) : mode === 'tour' && currentChapter ? currentChapter.description : finished ? '重播導覽，或自由查看感興趣的設備與樓層。' : '旋轉、縮放，從整體配置走近設備細節。'}</p></div>
          {mode === 'tour' && chapter >= 0 && <div className="tour-transport" aria-label="導覽播放控制"><button className="icon-button" type="button" aria-label="上一站" title="上一站" disabled={!loaded || !!error || chapter === 0} onClick={() => applyChapter(chapter - 1, playing)}><ArrowLeft {...ICON} /></button><button type="button" className="icon-button transport-play" disabled={!loaded || !!error} aria-label={actionLabel} title={actionLabel} onClick={startOrPause}>{playing ? <Pause {...ICON} weight="fill" /> : <Play {...ICON} weight="fill" />}</button><span className="tour-position">{chapter + 1}<span> / {CHAPTERS.length}</span></span><button className="icon-button" type="button" disabled={!loaded || !!error} aria-label={chapter === CHAPTERS.length - 1 ? '完成導覽' : '下一站'} title={chapter === CHAPTERS.length - 1 ? '完成導覽' : '下一站'} onClick={() => chapter === CHAPTERS.length - 1 ? returnOverview(true) : applyChapter(chapter + 1, playing)}>{chapter === CHAPTERS.length - 1 ? <Check {...ICON} /> : <ArrowRight {...ICON} />}</button></div>}
          <p className="interaction-hint">拖曳旋轉<span>滾輪縮放</span><span>右鍵平移</span></p>
        </div>
        <div className="mobile-dock"><button type="button" className="mobile-tour-start" disabled={!loaded || !!error} onClick={mode === 'tour' ? startOrPause : () => returnOverview()}>{mode === 'explore' ? <ArrowCounterClockwise {...ICON} /> : playing ? <Pause {...ICON} weight="fill" /> : <Play {...ICON} weight="fill" />}<span>{mode === 'tour' ? actionLabel : '返回總覽'}</span></button><button className="mobile-panel-toggle" ref={mobileTriggerRef} type="button" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}><List {...ICON} /><span>{mode === 'tour' ? '章節與探索' : '探索工具'}</span></button></div>
      </main>
    </div>
    <div className="status-announcement" role="status" aria-live="polite">{note}</div>

    <dialog className="about-dialog" ref={dialogRef} onCancel={() => setAboutOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setAboutOpen(false); }} aria-labelledby="about-title"><div className="about-content"><div className="dialog-heading"><h2 id="about-title">關於這個模型</h2><button type="button" className="icon-button" onClick={() => setAboutOpen(false)} aria-label="關閉說明"><X {...ICON} /></button></div><p className="about-lead">以最終 Blender 模型建立的 FAB-1 互動展示。</p><p>本模型依設計資料建立，保留設備與管線配置，並補充材質、廠房外殼及近景細節。未取得實測或原廠尺寸的構件採推導尺寸。</p><p>運轉模式加入 OHT 升降搬運、廠區車輛、閘門連鎖、裝卸門、設備燈號及風扇旋轉。節拍、車速與葉輪外觀採展示用假設，風扇轉速經視覺化放慢；流向標記不是 CFD 計算。</p><p>目前未接入即時感測資料，並非已驗證的竣工模型。設備面板展示的是模型資料。啟用系統「減少動態」時，預設暫停設備，可手動啟動。</p><div className="about-facts"><div><span>建築基準尺寸</span><strong>250 × 90 m</strong></div><div><span>檢視樓層</span><strong>B1 / 1F / 2F / RF</strong></div></div><h3>操作方式</h3><p>滑鼠拖曳可旋轉，滾輪可縮放，右鍵拖曳可平移。觸控裝置以單指旋轉、雙指縮放與平移。自由探索中的搜尋結果也可用鍵盤選取。</p><div className="about-links"><a href={publicUrl('README.txt')} target="_blank" rel="noreferrer">模型說明與資料依據<ArrowRight {...ICON} size={16} /></a><a href={publicUrl('gallery/HERO.webp')} target="_blank" rel="noreferrer">查看渲染總覽<ArrowRight {...ICON} size={16} /></a></div></div></dialog>
  </div>;
}
