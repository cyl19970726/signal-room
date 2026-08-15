import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleDot,
  FileSearch,
  Menu,
  PanelRightOpen,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  api,
  type FindingView,
  type IntakePreview,
  type ProjectView,
} from './api.ts';

type LoadState = 'idle' | 'collecting' | 'creating' | 'ready' | 'error';

export function App() {
  const [input, setInput] = useState('');
  const [question, setQuestion] = useState(
    '这条内容目前有哪些可验证的公开事实与研究边界？',
  );
  const [preview, setPreview] = useState<IntakePreview | null>(null);
  const [project, setProject] = useState<ProjectView | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    null,
  );
  const [state, setState] = useState<LoadState>('idle');
  const [message, setMessage] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const selectedFinding = useMemo(
    () =>
      project?.findings.find((finding) => finding.id === selectedFindingId) ??
      null,
    [project, selectedFindingId],
  );

  useEffect(() => {
    const projectId = new URLSearchParams(location.search).get('project');
    if (!projectId) return;
    setState('creating');
    void loadProject(projectId);
  }, []);

  async function loadProject(projectId: string) {
    try {
      const view = await api.getProject(projectId);
      setProject(view);
      setSelectedFindingId(view.findings[0]?.id ?? null);
      setState('ready');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '项目加载失败。');
      setState('error');
    }
  }

  async function collect() {
    setState('collecting');
    setMessage('正在使用已登录的 ego-browser 只读采集公开页面…');
    try {
      setPreview(await api.resolve(input));
      setMessage('采集完成。请核对规范化预览后创建持久研究项目。');
      setState('idle');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '采集停止。');
      setState('error');
    }
  }

  async function createAndResearch() {
    if (!preview) return;
    setState('creating');
    setMessage('正在创建 ResearchProject 并生成可追溯的 machine draft…');
    try {
      const created = await api.createProject(preview.contentId, question);
      await api.startRun(created.id);
      await new Promise((resolve) => setTimeout(resolve, 80));
      history.replaceState(null, '', `?project=${created.id}`);
      await loadProject(created.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '研究运行失败。');
      setState('error');
    }
  }

  function selectFinding(id: string) {
    setSelectedFindingId(id);
    setInspectorOpen(true);
  }

  return (
    <div className="workspace">
      <button
        className="mobile-control nav-toggle"
        aria-label="打开研究导航"
        onClick={() => setNavOpen(true)}
      >
        <Menu size={19} />
      </button>
      <Navigation
        open={navOpen}
        project={project}
        onClose={() => setNavOpen(false)}
      />
      <main className="decision-canvas">
        {project ? (
          <ProjectDesk
            project={project}
            selectedId={selectedFindingId}
            onSelect={selectFinding}
          />
        ) : (
          <IntakeDesk
            input={input}
            question={question}
            preview={preview}
            state={state}
            message={message}
            onInput={setInput}
            onQuestion={setQuestion}
            onCollect={() => void collect()}
            onCreate={() => void createAndResearch()}
          />
        )}
      </main>
      <button
        className="mobile-control inspector-toggle"
        aria-label="打开证据检查器"
        onClick={() => setInspectorOpen(true)}
      >
        <PanelRightOpen size={19} />
      </button>
      <EvidenceInspector
        finding={selectedFinding}
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        onReviewed={() => project && void loadProject(project.project.id)}
      />
    </div>
  );
}

function Navigation({
  open,
  project,
  onClose,
}: {
  open: boolean;
  project: ProjectView | null;
  onClose: () => void;
}) {
  return (
    <nav
      className={`research-nav ${open ? 'is-open' : ''}`}
      aria-label="研究工作区"
    >
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          SR
        </span>
        <div>
          <strong>Signal Room</strong>
          <small>证据优先研究桌</small>
        </div>
        <button
          className="nav-close"
          onClick={onClose}
          aria-label="关闭研究导航"
        >
          <X size={18} />
        </button>
      </div>
      <div className="nav-section">
        <span className="nav-kicker">工作台</span>
        <a className="nav-item active" href="/">
          <FileSearch size={16} /> 单帖研究
        </a>
        <span className="nav-item disabled">
          <CircleDot size={16} /> 样本库
        </span>
      </div>
      {project && (
        <div className="nav-section project-index">
          <span className="nav-kicker">当前项目</span>
          <span className="project-code">{project.project.id.slice(0, 8)}</span>
          <a href="#verdict">判断摘要</a>
          <a href="#findings">Findings</a>
          <a href="#source">来源边界</a>
        </div>
      )}
      <div className="nav-footnote">
        <ShieldAlert size={15} />
        <span>只读采集。登录、验证码、风控与用户接管会硬停止。</span>
      </div>
    </nav>
  );
}

function IntakeDesk(props: {
  input: string;
  question: string;
  preview: IntakePreview | null;
  state: LoadState;
  message: string;
  onInput: (value: string) => void;
  onQuestion: (value: string) => void;
  onCollect: () => void;
  onCreate: () => void;
}) {
  const busy = props.state === 'collecting' || props.state === 'creating';
  return (
    <div className="intake-desk">
      <header className="desk-header">
        <span className="eyebrow">XIAOHONGSHU / SINGLE POST</span>
        <h1>从一条帖子开始，建立可追溯的研究判断。</h1>
        <p>粘贴帖子或分享链接。真实页面仅通过已登录的 ego-browser 只读采集。</p>
      </header>
      <section className="intake-sheet" aria-labelledby="intake-title">
        <div className="section-number">01</div>
        <div className="section-body">
          <h2 id="intake-title">输入来源</h2>
          <label htmlFor="source-input">小红书帖子 / 分享文本</label>
          <textarea
            id="source-input"
            value={props.input}
            onChange={(event) => props.onInput(event.target.value)}
            placeholder="粘贴 https://xhslink.cn/... 或完整分享文本"
            rows={4}
          />
          <label htmlFor="question-input">研究问题</label>
          <input
            id="question-input"
            value={props.question}
            onChange={(event) => props.onQuestion(event.target.value)}
          />
          <button
            className="primary-action"
            onClick={props.onCollect}
            disabled={busy || !props.input.trim()}
          >
            {props.state === 'collecting' ? (
              <RefreshCw className="spin" size={17} />
            ) : (
              <Search size={17} />
            )}
            解析并只读采集
          </button>
          {props.message && (
            <p
              className={`status-line ${props.state === 'error' ? 'error' : ''}`}
              role="status"
            >
              {props.message}
            </p>
          )}
        </div>
      </section>
      {props.preview && (
        <section className="preview-sheet" aria-labelledby="preview-title">
          <div className="section-number">02</div>
          <div className="section-body">
            <div className="preview-heading">
              <div>
                <span className="eyebrow">NORMALIZED PREVIEW</span>
                <h2 id="preview-title">
                  {props.preview.title || '公开标题不可用'}
                </h2>
              </div>
              <span className="verified-label">
                <Check size={15} /> 已登录页面
              </span>
            </div>
            <dl className="preview-facts">
              <div>
                <dt>作者</dt>
                <dd>{props.preview.creatorName}</dd>
              </div>
              <div>
                <dt>类型</dt>
                <dd>{props.preview.contentType}</dd>
              </div>
              <div>
                <dt>公开点赞</dt>
                <dd>{knownMetric(props.preview.metrics.likes)}</dd>
              </div>
              <div>
                <dt>公开评论</dt>
                <dd>{knownMetric(props.preview.metrics.comments)}</dd>
              </div>
            </dl>
            <p className="source-excerpt">
              {props.preview.bodyExcerpt || '正文不可用。'}
            </p>
            <div className="boundary-note">
              <strong>证据边界</strong>
              <span>
                公开互动代理不等于播放、触达、留存、涨粉或转化；未知值保留为
                unknown。
              </span>
            </div>
            <button
              className="primary-action"
              onClick={props.onCreate}
              disabled={busy}
            >
              创建持久项目并研究 <ChevronRight size={17} />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function ProjectDesk({
  project,
  selectedId,
  onSelect,
}: {
  project: ProjectView;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const sample = project.samples[0];
  const unknowns = project.findings.filter(
    (finding) => finding.type === 'unknown',
  );
  return (
    <article className="project-desk">
      <header className="project-header">
        <div>
          <span className="eyebrow">
            SINGLE POST / {project.project.objective.toUpperCase()}
          </span>
          <h1>{project.project.research_question}</h1>
        </div>
        <span className={`project-status ${project.project.status}`}>
          {project.project.status}
        </span>
      </header>
      <section className="verdict-band" id="verdict">
        <div>
          <span className="band-label">当前判断</span>
          <p>{project.findings[1]?.statement ?? '研究结果正在生成。'}</p>
        </div>
        <div className="boundary-count">
          <strong>{project.findings.length}</strong>
          <span>finding</span>
          <strong>{unknowns.length}</strong>
          <span>关键 unknown</span>
        </div>
      </section>
      <section className="research-boundary" id="source">
        <div>
          <span className="band-label">样本 / 证据边界</span>
          <p>1 个 subject · 1 次公开指标观察 · 无作者或主题基线</p>
        </div>
        {sample && (
          <a href={sample.source_url} target="_blank" rel="noreferrer">
            查看来源 <ArrowUpRight size={15} />
          </a>
        )}
      </section>
      <section className="findings-section" id="findings">
        <div className="section-title-row">
          <div>
            <span className="eyebrow">REVIEW QUEUE</span>
            <h2>可核验 Findings</h2>
          </div>
          <span className="machine-label">machine draft</span>
        </div>
        <div className="finding-list">
          {project.findings.map((finding, index) => (
            <button
              key={finding.id}
              className={`finding-row ${selectedId === finding.id ? 'selected' : ''}`}
              onClick={() => onSelect(finding.id)}
            >
              <span className="finding-index">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className={`finding-type ${finding.type}`}>
                {finding.type}
              </span>
              <span className="finding-copy">
                <strong>{finding.statement}</strong>
                <small>
                  {finding.dimension} · {finding.confidence} confidence ·{' '}
                  {finding.review_status}
                </small>
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      </section>
      <section className="media-spine">
        <span className="eyebrow">MEDIA EVIDENCE</span>
        <h2>媒体证据脊柱</h2>
        <div className="unavailable-state">
          <span>00:00</span>
          <p>
            本次纵向链路尚无可合法取得的 transcript /
            frame。系统不会用页面文案伪装为媒体证据。
          </p>
        </div>
      </section>
    </article>
  );
}

function EvidenceInspector({
  finding,
  open,
  onClose,
  onReviewed,
}: {
  finding: FindingView | null;
  open: boolean;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const [reason, setReason] = useState('');
  const [reviewing, setReviewing] = useState(false);

  async function review(nextStatus: 'human_confirmed' | 'rejected') {
    if (!finding || !reason.trim()) return;
    setReviewing(true);
    try {
      await api.reviewFinding(finding.id, { nextStatus, reason });
      setReason('');
      onReviewed();
    } finally {
      setReviewing(false);
    }
  }

  return (
    <aside
      className={`evidence-inspector ${open ? 'is-open' : ''}`}
      aria-label="证据检查器"
    >
      <header className="inspector-header">
        <div>
          <span className="eyebrow">EVIDENCE INSPECTOR</span>
          <h2>证据与复核</h2>
        </div>
        <button onClick={onClose} aria-label="关闭证据检查器">
          <X size={18} />
        </button>
      </header>
      {!finding ? (
        <div className="inspector-empty">
          <FileSearch size={28} />
          <p>选择一个 finding，查看精确来源、反证、替代解释与范围。</p>
        </div>
      ) : (
        <div className="inspector-content">
          <div className="finding-meta">
            <span className={`finding-type ${finding.type}`}>
              {finding.type}
            </span>
            <span>{finding.confidence} confidence</span>
            <span>{finding.review_status.replace('_', ' ')}</span>
          </div>
          <p className="inspector-statement">{finding.statement}</p>
          <section>
            <h3>适用范围</h3>
            <p>{finding.scope.appliesTo}</p>
            <ul>
              {finding.scope.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>证据关系</h3>
            {finding.evidence.map((evidence) => (
              <div
                className={`evidence-record ${evidence.relation}`}
                key={`${evidence.evidence_id}-${evidence.relation}`}
              >
                <div>
                  <span>{evidence.relation}</span>
                  <code>{evidence.type}</code>
                </div>
                <p>{evidence.note}</p>
                {evidence.excerpt && (
                  <blockquote>{evidence.excerpt}</blockquote>
                )}
                <code className="locator">{evidence.locator}</code>
              </div>
            ))}
            {!finding.evidence.some(
              (item) => item.relation === 'contradicts',
            ) && (
              <p className="missing-relation">
                反证：本次单样本采集未取得可验证反证。
              </p>
            )}
            {!finding.evidence.some(
              (item) => item.relation === 'alternative',
            ) && (
              <p className="missing-relation">
                替代解释：需要对照样本与 owner data 才能进一步判断。
              </p>
            )}
          </section>
          <section className="review-controls">
            <h3>人工复核</h3>
            <label htmlFor="review-reason">复核理由</label>
            <textarea
              id="review-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <div>
              <button
                className="confirm"
                disabled={!reason.trim() || reviewing}
                onClick={() => void review('human_confirmed')}
              >
                <Check size={16} /> 确认
              </button>
              <button
                className="reject"
                disabled={!reason.trim() || reviewing}
                onClick={() => void review('rejected')}
              >
                <X size={16} /> 驳回
              </button>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}

function knownMetric(value: number | null | undefined) {
  return value === null || value === undefined
    ? 'unknown'
    : new Intl.NumberFormat('zh-CN').format(value);
}
